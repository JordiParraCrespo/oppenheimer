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
   * Deletes the bot's summary, its approvals (a pending card ends with the
   * conversation), its messages and its channels' conversations, and empties
   * its sidebar line, on `manager`. The turns are the caller's.
   */
  deleteWithin(manager: EntityManager, organizationId: string, botId: string): Promise<void>;
  /**
   * The id of the chat's open conversation with this bot, opened now when it
   * has none. One the chat had with another bot (the account answered as
   * that bot before) is closed first.
   */
  openTelegram(chat: BotTelegramChat): Promise<string>;
  /**
   * Closes the chat's open conversation if it was opened before `sentAt`,
   * so the chat's next message opens another (`/new`); one opened after is
   * left, so a `/new` delivered again closes nothing newer.
   */
  closeTelegram(chat: BotTelegramChat, sentAt: Date): Promise<void>;
  /**
   * The Telegram chat a conversation is, open or closed; null for any other
   * conversation, and once its Telegram bot was disconnected.
   */
  findTelegram(organizationId: string, conversationId: string): Promise<BotTelegramChat | null>;
}
