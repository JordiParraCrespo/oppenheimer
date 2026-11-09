import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import type {
  BotConversationRepositoryPort,
  BotTelegramChat,
} from './bot-conversation.repository.port';

@Injectable()
export class BotConversationRepository implements BotConversationRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  async conversationFor(chat: BotTelegramChat, messageId: string): Promise<string> {
    const params = [chat.organizationId, chat.telegramAccountId, chat.chatId, chat.botId];
    // UQ_bot_conversation_telegram_chat, read backwards from the message.
    const holding = () =>
      this.dataSource.query(
        `SELECT id FROM bot_conversation
          WHERE "telegramAccountId" = $2 AND "chatId" = $3 AND "botId" = $4
            AND "startsAtMessageId" <= $5 AND "organizationId" = $1
          ORDER BY "startsAtMessageId" DESC LIMIT 1`,
        [...params, messageId],
      ) as Promise<{ id: string }[]>;
    const [found] = await holding();
    if (found) return found.id;
    await this.startTelegram(chat, '0');
    const [opened] = await holding();
    return opened.id;
  }

  async startTelegram(chat: BotTelegramChat, messageId: string): Promise<void> {
    // UQ_bot_conversation_telegram_chat: a start already made is left as it is.
    await this.dataSource.query(
      `INSERT INTO bot_conversation ("organizationId", "botId", kind, "telegramAccountId", "chatId", "startsAtMessageId")
       VALUES ($1, $4, 'telegram', $2, $3, $5)
       ON CONFLICT ("telegramAccountId", "chatId", "botId", "startsAtMessageId")
         WHERE "telegramAccountId" IS NOT NULL DO NOTHING`,
      [chat.organizationId, chat.telegramAccountId, chat.chatId, chat.botId, messageId],
    );
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
