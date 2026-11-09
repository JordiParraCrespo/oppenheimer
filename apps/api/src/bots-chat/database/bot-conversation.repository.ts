import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { type BotConversationChatRecord, BotConversationMapper } from '../bot-conversation.mapper';
import {
  type ChannelConversationStart,
  channelConversationFor,
} from '../domain/bot-channel-turn.policy';
import type {
  BotChannelChat,
  BotConversationRepositoryPort,
} from './bot-conversation.repository.port';

/**
 * Each channel's account column, and the partial unique on its chats
 * (`UQ_bot_conversation_<kind>_chat`), whose predicate `ON CONFLICT` names.
 */
const ACCOUNT_COLUMN = {
  telegram: '"telegramAccountId"',
  whatsapp: '"whatsappAccountId"',
} as const satisfies Record<BotChannelChat['kind'], string>;

@Injectable()
export class BotConversationRepository implements BotConversationRepositoryPort {
  constructor(
    private readonly dataSource: DataSource,
    private readonly mapper: BotConversationMapper,
  ) {}

  async conversationAt(chat: BotChannelChat, startsAt: string, messageId: string): Promise<string> {
    const account = ACCOUNT_COLUMN[chat.kind];
    const params = [chat.organizationId, accountIdOf(chat), chat.chatId];
    // UQ_bot_conversation_<kind>_chat's leading columns: a chat's starts are a handful.
    const [latest]: ChannelConversationStart[] = await this.dataSource.query(
      `SELECT id, "botId", "startsAtMessageId"::text AS "startsAt" FROM bot_conversation
        WHERE ${account} = $2 AND "chatId" = $3 AND "organizationId" = $1
          AND "startsAtMessageId" <= $4::bigint
        ORDER BY "startsAtMessageId" DESC, ("botId" = $5) DESC LIMIT 1`,
      [...params, messageId, chat.botId],
    );
    const decided = channelConversationFor(latest ?? null, startsAt, messageId, chat.botId);
    if ('use' in decided) return decided.use;
    const { start } = decided;
    await this.dataSource.query(
      `INSERT INTO bot_conversation ("organizationId", "botId", kind, ${account}, "chatId", "startsAtMessageId")
       VALUES ($1, $4, $6, $2, $3, $5)
       ON CONFLICT (${account}, "chatId", "botId", "startsAtMessageId")
         WHERE ${account} IS NOT NULL DO NOTHING`,
      [...params, chat.botId, start, chat.kind],
    );
    const [opened]: { id: string }[] = await this.dataSource.query(
      `SELECT id FROM bot_conversation
        WHERE ${account} = $2 AND "chatId" = $3 AND "botId" = $4
          AND "startsAtMessageId" = $5::bigint AND "organizationId" = $1`,
      [...params, chat.botId, start],
    );
    return opened.id;
  }

  async findChannelChat(
    organizationId: string,
    conversationId: string,
  ): Promise<BotChannelChat | null> {
    // PK_bot_conversation.
    const [row]: BotConversationChatRecord[] = await this.dataSource.query(
      `SELECT "organizationId", "botId", kind, "telegramAccountId", "whatsappAccountId", "chatId"
         FROM bot_conversation
        WHERE "organizationId" = $1 AND id = $2 AND kind <> 'console'`,
      [organizationId, conversationId],
    );
    return row ? this.mapper.toChannelChat(row) : null;
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
    // A channel chat's conversations with no turn at work, their turns and
    // messages with them (FK_bot_turn_conversation, FK_bot_message_conversation).
    await manager.query(
      `DELETE FROM bot_conversation c
        WHERE c."organizationId" = $1 AND c."botId" = $2 AND c.kind <> 'console'
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

function accountIdOf(chat: BotChannelChat): string {
  return chat.kind === 'telegram' ? chat.telegramAccountId : chat.whatsappAccountId;
}
