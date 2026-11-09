import { BotMessageEntity } from './bot-message.entity';
import { BotTurnEntity } from './bot-turn.entity';

/** What a message of the owner's on Telegram is, for the turn it queues. */
export interface BotTelegramMessage {
  /** The conversation the Telegram chat is in with the bot. */
  conversationId: string;
  /** Telegram's id of the message, unique in its chat: the reply answers it. */
  messageId: string;
  text: string;
}

/** The key that makes a Telegram message one turn however often its event is delivered. */
export function telegramSourceKey(message: { conversationId: string; messageId: string }): string {
  return `telegram:${message.conversationId}:${message.messageId}`;
}

/** The Telegram message a turn answers, from its key; null for a turn that answers none. */
export function telegramMessageIdOf(sourceKey: string | null): string | null {
  const match = /^telegram:[0-9a-f-]{36}:(-?\d{1,21})$/.exec(sourceKey ?? '');
  return match?.[1] ?? null;
}

/**
 * The turn the owner's message on Telegram queues
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md` §3): in the
 * owner lane, as the owner, in the Telegram chat's own conversation, opened
 * by what they wrote as their message. It is the owner's own direct chat,
 * so it is theirs as a console message is: the bot's tools and memory.
 */
export function telegramTurn(
  props: Omit<
    Parameters<typeof BotTurnEntity.queue>[0],
    'origin' | 'sourceKey' | 'lane' | 'conversationId'
  >,
  message: BotTelegramMessage,
): { turn: BotTurnEntity; opening: BotMessageEntity } {
  const turn = BotTurnEntity.queue({
    ...props,
    conversationId: message.conversationId,
    origin: 'telegram',
    lane: 'owner',
    sourceKey: telegramSourceKey(message),
  });
  const opening = BotMessageEntity.createNew({
    organizationId: props.organizationId,
    botId: props.botId,
    conversationId: message.conversationId,
    turnId: turn.id,
    role: 'user',
    content: message.text,
    steps: [],
    position: 0,
  });
  return { turn, opening };
}

/**
 * What a Telegram turn sends back when it ends: its last text, or, with
 * none, what happened to it, so the person on their phone is never left
 * without an answer.
 */
export function telegramReplyOf(
  turn: { status: string; error: string | null },
  texts: readonly string[],
): string {
  const last = [...texts].reverse().find((text) => text.trim()) ?? null;
  if (turn.status === 'failed') {
    return `I could not finish that: ${turn.error ?? 'the turn failed.'}`;
  }
  if (last) return last;
  if (turn.status === 'cancelled') return 'Stopped.';
  return 'Done, with nothing to say here. The console has the details.';
}
