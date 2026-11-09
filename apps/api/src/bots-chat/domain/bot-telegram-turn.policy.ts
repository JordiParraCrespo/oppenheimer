import { BotMessageEntity } from './bot-message.entity';
import { BotTurnEntity } from './bot-turn.entity';

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

/** A Telegram conversation's start in a chat, and the bot it is with. */
export interface TelegramConversationStart {
  id: string;
  botId: string;
  /** The Telegram message id it starts at, as text: ids pass a JavaScript number. */
  startsAt: string;
}

/**
 * Which conversation a message of a Telegram chat belongs to
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md`): `latest` is
 * the chat's latest start at or before the message (the asking bot's first
 * when two start there), `startsAt` the owner's last `/new` at or before it
 * ('0' for none). The latest start, when it is no earlier than that `/new`
 * and is this bot's, holds the message. Otherwise a start is owed: at the
 * `/new`, or at the message itself when the latest start is another bot's
 * (the Telegram bot was bound to another and back), so this bot starts afresh.
 */
export function telegramConversationFor(
  latest: TelegramConversationStart | null,
  startsAt: string,
  messageId: string,
  botId: string,
): { use: string } | { start: string } {
  const current = latest && BigInt(latest.startsAt) >= BigInt(startsAt) ? latest : null;
  if (current?.botId === botId) return { use: current.id };
  return { start: current ? messageId : startsAt };
}
