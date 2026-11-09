import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import type {
  BotConversationRepositoryPort,
  BotTelegramChat,
} from './bot-conversation.repository.port';

@Injectable()
export class BotConversationRepository implements BotConversationRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  async conversationAt(
    chat: BotTelegramChat,
    startsAt: string,
    messageId: string,
  ): Promise<string> {
    const params = [chat.organizationId, chat.telegramAccountId, chat.chatId];
    // UQ_bot_conversation_telegram_chat's leading columns: a chat's starts are a handful.
    const [latest]: { id: string; botId: string; startsAt: string }[] = await this.dataSource.query(
      `SELECT id, "botId", "startsAtMessageId"::text AS "startsAt" FROM bot_conversation
        WHERE "telegramAccountId" = $2 AND "chatId" = $3 AND "organizationId" = $1
          AND "startsAtMessageId" <= $4::bigint
        ORDER BY "startsAtMessageId" DESC LIMIT 1`,
      [...params, messageId],
    );
    const current = latest && BigInt(latest.startsAt) >= BigInt(startsAt) ? latest : null;
    if (current?.botId === chat.botId) return current.id;
    const start = current ? messageId : startsAt;
    await this.dataSource.query(
      `INSERT INTO bot_conversation ("organizationId", "botId", kind, "telegramAccountId", "chatId", "startsAtMessageId")
       VALUES ($1, $4, 'telegram', $2, $3, $5)
       ON CONFLICT ("telegramAccountId", "chatId", "botId", "startsAtMessageId")
         WHERE "telegramAccountId" IS NOT NULL DO NOTHING`,
      [...params, chat.botId, start],
    );
    const [opened]: { id: string }[] = await this.dataSource.query(
      `SELECT id FROM bot_conversation
        WHERE "telegramAccountId" = $2 AND "chatId" = $3 AND "botId" = $4
          AND "startsAtMessageId" = $5::bigint AND "organizationId" = $1`,
      [...params, chat.botId, start],
    );
    return opened.id;
  }

  async findTelegram(
    organizationId: string,
    conversationId: string,
  ): Promise<BotTelegramChat | null> {
    // PK_bot_conversation.
    const [row]: BotTelegramChat[] = await this.dataSource.query(
      `SELECT "organizationId", "botId", "telegramAccountId", "chatId" FROM bot_conversation
        WHERE "organizationId" = $1 AND id = $2 AND kind = 'telegram'
          AND "telegramAccountId" IS NOT NULL`,
      [organizationId, conversationId],
    );
    return row ?? null;
  }

  async deleteWithin(manager: EntityManager, organizationId: string, botId: string): Promise<void> {
    const params = [organizationId, botId];
    // Each by its bot index (the summary by its key), children before the
    // turns the caller deletes after, so no row is left to a cascade.
    await manager.query(
      `DELETE FROM bot_conversation_summary WHERE "organizationId" = $1 AND "botId" = $2`,
      params,
    );
    await manager.query(
      `DELETE FROM bot_approval WHERE "organizationId" = $1 AND "botId" = $2`,
      params,
    );
    await manager.query(
      `DELETE FROM bot_question WHERE "organizationId" = $1 AND "botId" = $2`,
      params,
    );
    // A Telegram chat's conversations with no turn at work, their turns and
    // messages with them (FK_bot_turn_conversation, FK_bot_message_conversation).
    await manager.query(
      `DELETE FROM bot_conversation c
        WHERE c."organizationId" = $1 AND c."botId" = $2 AND c.kind = 'telegram'
          AND NOT EXISTS (
            SELECT 1 FROM bot_turn t
             WHERE t."organizationId" = c."organizationId" AND t."conversationId" = c.id
               AND t.status IN ('queued', 'running'))`,
      params,
    );
    // The console chat's: its conversation's id is the bot's.
    await manager.query(
      `DELETE FROM bot_message WHERE "organizationId" = $1 AND "conversationId" = $2`,
      params,
    );
    await manager.query(
      `UPDATE bot SET "lastMessageAt" = NULL, "lastMessagePreview" = NULL
        WHERE "organizationId" = $1 AND id = $2`,
      params,
    );
  }
}
