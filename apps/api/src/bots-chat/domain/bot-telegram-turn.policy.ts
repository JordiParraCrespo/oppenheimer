import { type ChannelTurnProps, channelTurn } from './bot-channel-turn.policy';
import type { BotMessageEntity } from './bot-message.entity';
import type { BotTurnEntity } from './bot-turn.entity';

/** What a message of the owner's on Telegram is, for the turn it queues. */
export interface BotTelegramMessage {
  /** The conversation the Telegram chat is in with the bot. */
  conversationId: string;
  /** The Telegram bot it came through, and the chat there. */
  telegramAccountId: string;
  chatId: string;
  /** Telegram's id of the message, unique in its chat: the reply answers it. */
  messageId: string;
  text: string;
}

/**
 * The key that makes a Telegram message one turn however often its event is
 * delivered: the message itself (its Telegram bot, chat and id), never the
 * conversation, which a `/new` in between would change.
 */
export function telegramSourceKey(
  message: Pick<BotTelegramMessage, 'telegramAccountId' | 'chatId' | 'messageId'>,
): string {
  return `telegram:${message.telegramAccountId}:${message.chatId}:${message.messageId}`;
}

/** The Telegram message a turn answers, from its key; null for a turn that answers none. */
export function telegramMessageIdOf(sourceKey: string | null): string | null {
  const match = /^telegram:[0-9a-f-]{36}:-?\d{1,21}:(-?\d{1,21})$/.exec(sourceKey ?? '');
  return match?.[1] ?? null;
}

/** The turn the owner's message on Telegram queues, in the chat's own conversation. */
export function telegramTurn(
  props: ChannelTurnProps,
  message: BotTelegramMessage,
): { turn: BotTurnEntity; opening: BotMessageEntity } {
  return channelTurn(props, {
    origin: 'telegram',
    sourceKey: telegramSourceKey(message),
    conversationId: message.conversationId,
    text: message.text,
  });
}
