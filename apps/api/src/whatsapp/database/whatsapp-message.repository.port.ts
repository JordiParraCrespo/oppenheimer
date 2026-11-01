import type {
  WhatsappChat,
  WhatsappMessage,
  WhatsappMessageDraft,
} from '../domain/whatsapp-message.types';

/** Which account's messages: the account and its workspace, always together. */
export interface WhatsappAccountRef {
  organizationId: string;
  accountId: string;
}

/**
 * A number's messages (`product/next-steps/whatsapp.md` §3). Reads take an
 * account the caller already proved is theirs (`WhatsappAccountRepositoryPort`),
 * so this port holds no scope of its own; every list is bounded.
 */
export interface WhatsappMessageRepositoryPort {
  /** Stores what is new; a message already kept (same chat and id) is left as it is. */
  insertMany(messages: readonly WhatsappMessageDraft[]): Promise<void>;
  /**
   * Stores what a bot sent, marking it the bot's: if the host's own copy of
   * the message arrived first, it gains the bot rather than a twin.
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
  /** How many messages bots sent from the account since `since`. */
  countBotSendsSince(account: WhatsappAccountRef, since: Date): Promise<number>;
}
