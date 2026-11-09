import type { EntityManager } from 'typeorm';

/** A Telegram chat with a bot: the account it came through and the chat's id there. */
export interface BotTelegramChat {
  organizationId: string;
  botId: string;
  telegramAccountId: string;
  chatId: string;
}

/**
 * A bot's conversations as rows, apart from their turns: what Clear history
 * erases besides them, and the conversation a Telegram chat with the bot is
 * in. Clear history owns no transaction of its own; the turn repository
 * calls it under the lock a send takes, on that transaction's manager, so
 * the deletes and the check that no turn works are one write.
 */
export interface BotConversationRepositoryPort {
  /**
   * Deletes the console chat (the bot's summary, its approvals, since a
   * pending card ends with the conversation, and the chat's messages) and
   * every Telegram conversation of the bot with no turn at work, with its
   * turns and messages, and empties the sidebar line, on `manager`. The
   * console chat's turns are the caller's.
   */
  deleteWithin(manager: EntityManager, organizationId: string, botId: string): Promise<void>;
  /**
   * The id of the chat's conversation that holds message `messageId`, whose
   * last `/new` at or before it was `startsAt` ('0' for none): the
   * conversation starting there, made now when the chat has none. When the
   * chat's latest conversation at or before the message, starting no
   * earlier, is another bot's (the Telegram bot was bound to another and
   * back), this bot starts afresh at the message. Telegram numbers a chat's
   * messages in order and the start is fixed when the message is stored, so
   * every delivery of it agrees, in any order.
   */
  conversationAt(chat: BotTelegramChat, startsAt: string, messageId: string): Promise<string>;
  /**
   * The Telegram chat a conversation is, open or closed; null for any other
   * conversation, and once its Telegram bot was disconnected.
   */
  findTelegram(organizationId: string, conversationId: string): Promise<BotTelegramChat | null>;
}
