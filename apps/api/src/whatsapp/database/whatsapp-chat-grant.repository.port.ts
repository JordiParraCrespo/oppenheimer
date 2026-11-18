import type { Option } from 'oxide.ts';
import type { WhatsappChatGrantEntity } from '../domain/whatsapp-chat-grant.entity';

/** A number's place: every read of its grants is by the number, found as its owner first. */
export interface WhatsappGrantsOf {
  organizationId: string;
  accountId: string;
}

/**
 * The chats a number allows. Reads and writes are by the number, which the
 * caller has already found as its owner (`WhatsappChatResolver.account`), so
 * nobody reaches another person's grants through an id.
 */
export interface WhatsappChatGrantRepositoryPort {
  /** The number's allowed chats, the oldest first. */
  findAll(of: WhatsappGrantsOf): Promise<WhatsappChatGrantEntity[]>;
  findById(of: WhatsappGrantsOf, id: string): Promise<Option<WhatsappChatGrantEntity>>;
  findByChat(of: WhatsappGrantsOf, chatId: string): Promise<Option<WhatsappChatGrantEntity>>;
  count(of: WhatsappGrantsOf): Promise<number>;
  /** A new grant; a chat already allowed answers `taken` (`UQ_whatsapp_chat_grant_chat`). */
  insert(grant: WhatsappChatGrantEntity): Promise<'inserted' | 'taken'>;
  /** Writes which bot answers in the chat, and its name as last seen. */
  save(grant: WhatsappChatGrantEntity): Promise<void>;
  delete(grant: WhatsappChatGrantEntity): Promise<void>;
}
