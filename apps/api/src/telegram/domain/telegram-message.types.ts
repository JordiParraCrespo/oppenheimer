import type { TelegramMediaKind } from '@oppenheimer/shared/protocol';

/**
 * One message a Telegram bot received (`telegram.messages`), or one its
 * owner's Oppenheimer bot sent through it, as the control plane keeps it for
 * the bots to read. Kept for `TELEGRAM_RETENTION_DAYS`; nothing else of a
 * chat is stored.
 */
export interface TelegramMessage {
  id: string;
  accountId: string;
  organizationId: string;
  /** Telegram's message id, unique within its chat. */
  externalId: string;
  chatId: string;
  chatKind: 'direct' | 'group';
  chatName: string | null;
  senderId: string;
  senderName: string | null;
  senderUsername: string | null;
  /** The Telegram bot itself sent it (an Oppenheimer bot, through `send_telegram_message`). */
  fromBot: boolean;
  text: string;
  media: TelegramMediaKind | null;
  replyToId: string | null;
  sentAt: Date;
  /** The Oppenheimer bot that sent it through `send_telegram_message`; null for everything else. */
  sentByBotId: string | null;
}

/** A message as intake writes it: everything but the row's own id. */
export type TelegramMessageDraft = Omit<TelegramMessage, 'id'>;

/** One chat of a Telegram bot, as the bots list them: its last message and how many there are. */
export interface TelegramChat {
  accountId: string;
  chatId: string;
  chatKind: 'direct' | 'group';
  chatName: string | null;
  messageCount: number;
  last: TelegramMessage;
}

/** Where a message goes: a chat the Telegram bot already has a message in. */
export interface TelegramChatTarget {
  chatId: string;
  chatKind: 'direct' | 'group';
  chatName: string | null;
}
