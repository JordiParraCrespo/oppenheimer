import type { DomainEvent } from '@oppenheimer/backend-ddd';
import type { Option } from 'oxide.ts';
import type {
  TelegramChat,
  TelegramMessage,
  TelegramMessageDraft,
} from '../domain/telegram-message.types';

/** Which account's messages: the account and its workspace, always together. */
export interface TelegramAccountRef {
  organizationId: string;
  accountId: string;
}

/**
 * What new messages owe: an event built from the id of the owner's last
 * `/new` in the message's chat at or before it ('0' for none), which only
 * the store can say once the whole batch is in.
 */
export interface TelegramMessagesOwed {
  ownerTelegramId: string | null;
  eventFor: (message: TelegramMessageDraft) => ((lastNewId: string) => DomainEvent | null) | null;
}

/**
 * A Telegram bot's messages (`product/next-steps/telegram.md` §4). Reads take an
 * account the caller already proved is theirs (`TelegramAccountRepositoryPort`),
 * so this port holds no scope of its own; every list is bounded.
 */
export interface TelegramMessageRepositoryPort {
  /**
   * Stores what is new; a message already kept (same chat and id) is left as
   * it is. Each new message's event (`owed`), if it owes one, is staged on
   * the outbox in the same transaction, told the id of the owner's last
   * `/new` in its chat at or before it. Answers the new messages.
   */
  insertMany(
    messages: readonly TelegramMessageDraft[],
    owed?: TelegramMessagesOwed,
  ): Promise<TelegramMessageDraft[]>;
  /** Whether the Telegram bot wrote anything in a chat since `since`: a stranger's daily line. */
  wroteInChatSince(account: TelegramAccountRef, chatId: string, since: Date): Promise<boolean>;
  /**
   * Stores what a bot sent, marking it the bot's: a second record of the same
   * message (a retried send) gains the bot rather than a twin.
   */
  recordBotSend(message: TelegramMessageDraft): Promise<void>;
  /** Deletes up to `limit` of the account's messages sent before `before`; answers how many. */
  pruneBefore(account: TelegramAccountRef, before: Date, limit: number): Promise<number>;
  /** Deletes up to `limit` of the account's oldest messages past its newest `keep`; answers how many. */
  pruneBeyond(account: TelegramAccountRef, keep: number, limit: number): Promise<number>;
  /** The account's chats, the most recently active first. */
  findChats(account: TelegramAccountRef, limit: number): Promise<TelegramChat[]>;
  /** One chat by its exact id, however long ago it was active. */
  findChat(account: TelegramAccountRef, chatId: string): Promise<Option<TelegramChat>>;
  /** One chat's messages before `before` (or the newest), newest first. */
  findInChat(
    account: TelegramAccountRef,
    chatId: string,
    limit: number,
    before: Date | null,
  ): Promise<TelegramMessage[]>;
  /** Messages whose text holds `query`, ignoring case, newest first. */
  search(account: TelegramAccountRef, query: string, limit: number): Promise<TelegramMessage[]>;
  /** How many messages bots sent through the account since `since`. */
  countBotSendsSince(account: TelegramAccountRef, since: Date): Promise<number>;
}
