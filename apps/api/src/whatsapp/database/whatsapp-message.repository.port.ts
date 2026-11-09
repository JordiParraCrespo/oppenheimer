import type { DomainEvent } from '@oppenheimer/backend-ddd';
import type {
  WhatsappChat,
  WhatsappChatPlace,
  WhatsappMessage,
  WhatsappMessageDraft,
  WhatsappStoredMessage,
} from '../domain/whatsapp-message.types';

/** Which account's messages: the account and its workspace, always together. */
export interface WhatsappAccountRef {
  organizationId: string;
  accountId: string;
}

/**
 * What new messages owe: the owner's are placed in their chat (which only the
 * store can say once the whole batch is in), and each new message may owe an
 * event built from its place, staged in the transaction that stored it.
 */
export interface WhatsappMessagesOwed {
  /** The confirmed owner's own number: only their `/new`s start a conversation. */
  ownerPhone: string;
  /** The number's default bot, for a chat with no switch at or before a message. */
  answeringBotId: string | null;
  /** Whether a new message is the owner's, to be placed. */
  isOwners: (message: WhatsappMessageDraft) => boolean;
  eventFor: (message: WhatsappStoredMessage, place: WhatsappChatPlace) => DomainEvent | null;
}

/**
 * A number's messages (`product/next-steps/whatsapp.md` §3). Reads take an
 * account the caller already proved is theirs (`WhatsappAccountRepositoryPort`),
 * so this port holds no scope of its own; every list is bounded.
 */
export interface WhatsappMessageRepositoryPort {
  /**
   * Stores what is new, in one transaction; a message already kept (same chat
   * and id) is left as it is, with the `seq` it was first given. With `owed`,
   * each new message of the owner's is placed in its chat (`place`), and the
   * event it owes, if any, is staged on the outbox with it. Answers the new
   * messages, in the order given.
   */
  insertMany(
    messages: readonly WhatsappMessageDraft[],
    owed?: WhatsappMessagesOwed,
  ): Promise<WhatsappStoredMessage[]>;
  /**
   * Stores what went out from the number, marking it the bot's (and a reply,
   * and what it quotes): if the host's own copy of the message arrived first,
   * it gains those rather than a twin.
   */
  recordBotSend(message: WhatsappMessageDraft): Promise<void>;
  /** Deletes up to `limit` of the account's messages sent before `before`; answers how many. */
  pruneBefore(account: WhatsappAccountRef, before: Date, limit: number): Promise<number>;
  /** Deletes up to `limit` of the account's oldest messages past its newest `keep`; answers how many. */
  pruneBeyond(account: WhatsappAccountRef, keep: number, limit: number): Promise<number>;
  /** The account's chats, the most recently active first. */
  findChats(account: WhatsappAccountRef, limit: number): Promise<WhatsappChat[]>;
  /** One chat's messages before `before` (or the newest), newest first. */
  findInChat(
    account: WhatsappAccountRef,
    chatId: string,
    limit: number,
    before: Date | null,
  ): Promise<WhatsappMessage[]>;
  /** Messages whose text holds `query`, ignoring case, newest first. */
  search(account: WhatsappAccountRef, query: string, limit: number): Promise<WhatsappMessage[]>;
  /** One stored message by its row id: what a reply quotes. */
  findById(account: WhatsappAccountRef, id: string): Promise<WhatsappMessage | null>;
  /**
   * The chat's bot now: the bot of its latest switch by name, or null when
   * none was made (the number's default then answers).
   */
  findSwitchedBot(account: WhatsappAccountRef, chatId: string): Promise<string | null>;
  /** How many messages bots sent from the account since `since`; their answers to the owner are not counted. */
  countBotSendsSince(account: WhatsappAccountRef, since: Date): Promise<number>;
}
