import type { WhatsappMediaKind } from '@oppenheimer/shared/protocol';

/**
 * One message a linked number saw (`whatsapp.messages`), or one its owner's
 * bot sent through it, as the control plane keeps it for the bots to read.
 * Kept for `WHATSAPP_RETENTION_DAYS`; nothing else of a chat is stored.
 */
export interface WhatsappMessage {
  id: string;
  accountId: string;
  organizationId: string;
  /** WhatsApp's id, unique within its chat. */
  externalId: string;
  chatId: string;
  chatKind: 'direct' | 'group';
  chatName: string | null;
  senderId: string;
  senderName: string | null;
  fromMe: boolean;
  text: string;
  media: WhatsappMediaKind | null;
  quotedId: string | null;
  sentAt: Date;
  /** The bot that sent it through `send_whatsapp_message`; null for everything else. */
  sentByBotId: string | null;
}

/** A message as intake writes it: everything but the row's own id. */
export type WhatsappMessageDraft = Omit<WhatsappMessage, 'id'>;

/** One chat of a number, as the bots list them: its last message and how many there are. */
export interface WhatsappChat {
  accountId: string;
  chatId: string;
  chatKind: 'direct' | 'group';
  chatName: string | null;
  messageCount: number;
  last: WhatsappMessage;
}

/** Where a message goes: a chat the number has, or a new direct chat with a phone number. */
export interface WhatsappChatTarget {
  chatId: string;
  chatKind: 'direct' | 'group';
  chatName: string | null;
  /** The number has no message in this chat yet. */
  isNew: boolean;
}
