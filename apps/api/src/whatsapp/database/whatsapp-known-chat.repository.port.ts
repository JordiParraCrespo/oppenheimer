import type { WhatsappKnownChat } from '../domain/whatsapp-message.types';
import type { WhatsappGrantsOf } from './whatsapp-chat-grant.repository.port';

/**
 * The chats a number's device says it can be reached in. Written by the
 * system from the host's link, read by the number's owner through Settings,
 * found as theirs first; never a history, only the list as last reported.
 */
export interface WhatsappKnownChatRepositoryPort {
  /** The number's known chats, by name. */
  findAll(of: WhatsappGrantsOf, limit: number): Promise<WhatsappKnownChat[]>;
  /**
   * Keeps what the device reported: a chat already known takes its new kind
   * and name, a new one is added while the number holds fewer than `max`.
   */
  record(of: WhatsappGrantsOf, chats: readonly WhatsappKnownChat[], max: number): Promise<void>;
}
