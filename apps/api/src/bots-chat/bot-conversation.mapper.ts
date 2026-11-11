import { Injectable } from '@nestjs/common';
import type { BotConversationOrmEntity } from './database/bot-conversation.orm-entity';
import type { BotChannelChat } from './database/bot-conversation.repository.port';

/** The columns a channel conversation is read back with. */
export type BotConversationChatRecord = Pick<
  BotConversationOrmEntity,
  'organizationId' | 'botId' | 'kind' | 'telegramAccountId' | 'whatsappAccountId' | 'chatId'
>;

/**
 * A bot conversation's row as the channel chat it is with: Telegram's or
 * WhatsApp's, with the account it came through; null for the console's, or
 * for a chat whose account is gone (disconnected or unlinked).
 */
@Injectable()
export class BotConversationMapper {
  toChannelChat(record: BotConversationChatRecord): BotChannelChat | null {
    const { organizationId, botId, chatId } = record;
    if (chatId === null) return null;
    if (record.kind === 'telegram' && record.telegramAccountId) {
      return {
        kind: 'telegram',
        organizationId,
        botId,
        chatId,
        telegramAccountId: record.telegramAccountId,
      };
    }
    if (record.kind === 'whatsapp' && record.whatsappAccountId) {
      return {
        kind: 'whatsapp',
        organizationId,
        botId,
        chatId,
        whatsappAccountId: record.whatsappAccountId,
      };
    }
    return null;
  }
}
