import type { EntityManager } from 'typeorm';

/** What every channel's chat with a bot has: the bot, and the chat's id on that channel. */
interface BotChannelChatOf<K extends string> {
  kind: K;
  organizationId: string;
  botId: string;
  /** Telegram's chat id, or the WhatsApp chat's JID. */
  chatId: string;
}

/** A Telegram chat with a bot: the Telegram bot it came through and the chat's id there. */
export interface BotTelegramChat extends BotChannelChatOf<'telegram'> {
  telegramAccountId: string;
}

/** A WhatsApp chat with a bot: the linked number it came through and the chat's JID. */
export interface BotWhatsappChat extends BotChannelChatOf<'whatsapp'> {
  whatsappAccountId: string;
}

/** A channel's chat with a bot, outside the console. */
export type BotChannelChat = BotTelegramChat | BotWhatsappChat;

/**
 * A bot's conversations as rows, apart from their turns: what Clear history
 * erases besides them, and the conversation a channel's chat with the bot is
 * in. Clear history owns no transaction of its own; the turn repository
 * calls it under the lock a send takes, on that transaction's manager, so
 * the deletes and the check that no turn works are one write.
 */
export interface BotConversationRepositoryPort {
  /**
   * Deletes the console chat (the bot's summary, its approvals, since a
   * pending card ends with the conversation, and the chat's messages) and
   * every channel conversation of the bot with no turn at work, with its
   * turns and messages, and empties the sidebar line, on `manager`. The
   * console chat's turns are the caller's.
   */
  deleteWithin(manager: EntityManager, organizationId: string, botId: string): Promise<void>;
  /**
   * The id of the chat's conversation that holds message `messageId`, whose
   * last start at or before it was `startsAt` ('0' for none: on Telegram the
   * owner's last `/new`, on WhatsApp the later of that and a switch to a bot
   * by name): the conversation starting there, made now when the chat has
   * none. When the chat's latest conversation at or before the message,
   * starting no earlier, is another bot's, this bot starts afresh at the
   * message. `messageId` is in the chat's order (Telegram's id, or
   * `whatsapp_message.seq`) and the start is fixed when the message is
   * stored, so every delivery of it agrees, in any order.
   */
  conversationAt(chat: BotChannelChat, startsAt: string, messageId: string): Promise<string>;
  /**
   * The channel chat a conversation is, open or closed; null for the console
   * chat, and once its account (the Telegram bot, the linked number) was
   * disconnected.
   */
  findChannelChat(organizationId: string, conversationId: string): Promise<BotChannelChat | null>;
}
