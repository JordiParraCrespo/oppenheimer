import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import type {
  BotConversationRepositoryPort,
  BotTelegramChat,
} from './bot-conversation.repository.port';

@Injectable()
export class BotConversationRepository implements BotConversationRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  openTelegram(chat: BotTelegramChat): Promise<string> {
    return this.dataSource.transaction(async (manager) => {
      const params = [chat.organizationId, chat.telegramAccountId, chat.chatId];
      // UQ_bot_conversation_telegram_chat: another bot's is closed, so the
      // insert below opens this bot's.
      await manager.query(
        `UPDATE bot_conversation SET "archivedAt" = now(), "updatedAt" = now()
          WHERE "organizationId" = $1 AND "telegramAccountId" = $2 AND "chatId" = $3
            AND "archivedAt" IS NULL AND "botId" <> $4`,
        [...params, chat.botId],
      );
      await manager.query(
        `INSERT INTO bot_conversation ("organizationId", "botId", kind, "telegramAccountId", "chatId")
         VALUES ($1, $4, 'telegram', $2, $3)
         ON CONFLICT ("telegramAccountId", "chatId") WHERE "archivedAt" IS NULL DO NOTHING`,
        [...params, chat.botId],
      );
      const [open]: { id: string }[] = await manager.query(
        `SELECT id FROM bot_conversation
          WHERE "telegramAccountId" = $2 AND "chatId" = $3 AND "archivedAt" IS NULL
            AND "organizationId" = $1`,
        params,
      );
      return open.id;
    });
  }

  async findTelegram(
    organizationId: string,
    conversationId: string,
  ): Promise<BotTelegramChat | null> {
    // PK_bot_conversation.
    const [row]: BotTelegramChat[] = await this.dataSource.query(
      `SELECT "organizationId", "botId", "telegramAccountId", "chatId" FROM bot_conversation
        WHERE "organizationId" = $1 AND id = $2 AND kind = 'telegram'`,
      [organizationId, conversationId],
    );
    return row ?? null;
  }

  async closeTelegram(chat: BotTelegramChat): Promise<void> {
    // UQ_bot_conversation_telegram_chat.
    await this.dataSource.query(
      `UPDATE bot_conversation SET "archivedAt" = now(), "updatedAt" = now()
        WHERE "telegramAccountId" = $2 AND "chatId" = $3 AND "archivedAt" IS NULL
          AND "organizationId" = $1`,
      [chat.organizationId, chat.telegramAccountId, chat.chatId],
    );
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
    await manager.query(
      `DELETE FROM bot_message WHERE "organizationId" = $1 AND "botId" = $2`,
      params,
    );
    await manager.query(
      `DELETE FROM bot_conversation WHERE "organizationId" = $1 AND "botId" = $2 AND kind <> 'console'`,
      params,
    );
    await manager.query(
      `UPDATE bot SET "lastMessageAt" = NULL, "lastMessagePreview" = NULL
        WHERE "organizationId" = $1 AND id = $2`,
      params,
    );
  }
}
