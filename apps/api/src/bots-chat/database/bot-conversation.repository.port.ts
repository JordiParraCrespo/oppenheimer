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
   * Deletes the console chat: the bot's summary, its approvals (a pending
   * card ends with the conversation) and the chat's messages, and empties
   * the sidebar line, on `manager`. A Telegram chat's conversations are not
   * the console's to clear (`/new` there starts afresh). The turns are the
   * caller's.
   */
  deleteWithin(manager: EntityManager, organizationId: string, botId: string): Promise<void>;
  /**
   * The id of the chat's conversation with this bot that holds `messageId`:
   * the one starting at or before it, opened (from 0) when the chat has
   * none. Telegram numbers a chat's messages in order, so the answer is the
   * same whatever order the deliveries come in.
   */
  conversationFor(chat: BotTelegramChat, messageId: string): Promise<string>;
  /** Starts a conversation at `messageId` (`/new`); a delivery again starts nothing more. */
  startTelegram(chat: BotTelegramChat, messageId: string): Promise<void>;
  /**
   * The Telegram chat a conversation is, open or closed; null for any other
   * conversation, and once its Telegram bot was disconnected.
   */
  findTelegram(organizationId: string, conversationId: string): Promise<BotTelegramChat | null>;
}
