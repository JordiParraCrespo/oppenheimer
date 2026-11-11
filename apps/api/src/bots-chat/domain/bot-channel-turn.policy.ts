import type { BotChannelOrigin } from '@oppenheimer/shared';
import { BotMessageEntity } from './bot-message.entity';
import { BotTurnEntity } from './bot-turn.entity';

/** What a channel turn takes from the bot it wakes: everything but where it runs. */
export type ChannelTurnProps = Omit<
  Parameters<typeof BotTurnEntity.queue>[0],
  'origin' | 'sourceKey' | 'lane' | 'conversationId'
>;

/**
 * The turn the owner's message on a channel queues
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md` §3): in the
 * owner lane, as the owner, in the chat's own conversation, opened by what
 * they wrote as their message. It is the owner's own direct chat, so it is
 * theirs as a console message is: the bot's tools and memory. The channel
 * names its origin and the key that makes the message one turn.
 */
export function channelTurn(
  props: ChannelTurnProps,
  message: { origin: BotChannelOrigin; sourceKey: string; conversationId: string; text: string },
): { turn: BotTurnEntity; opening: BotMessageEntity } {
  const turn = BotTurnEntity.queue({
    ...props,
    conversationId: message.conversationId,
    origin: message.origin,
    lane: 'owner',
    sourceKey: message.sourceKey,
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
 * What a channel's turn (Telegram, WhatsApp) sends back when it ends: its
 * last text, or, with none, what happened to it, so the person on their
 * phone is never left without an answer.
 */
export function channelReplyOf(
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

/** A channel conversation's start in a chat, and the bot it is with. */
export interface ChannelConversationStart {
  id: string;
  botId: string;
  /**
   * The message it starts at, in the chat's order, as text: Telegram's id or
   * `whatsapp_message.seq`, either of which passes a JavaScript number.
   */
  startsAt: string;
}

/**
 * Which conversation a message of a channel's chat belongs to
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md`): `latest` is
 * the chat's latest start at or before the message (the asking bot's first
 * when two start there), `startsAt` the chat's last start the messages name
 * at or before it ('0' for none: the owner's `/new`, or on WhatsApp a switch
 * to a bot by name). The latest start, when it is no earlier than that and
 * is this bot's, holds the message. Otherwise a start is owed: there, or at
 * the message itself when the latest start is another bot's (the chat was
 * answered by another and back), so this bot starts afresh. Positions are
 * compared as numbers, never as text.
 */
export function channelConversationFor(
  latest: ChannelConversationStart | null,
  startsAt: string,
  messageId: string,
  botId: string,
): { use: string } | { start: string } {
  const current = latest && BigInt(latest.startsAt) >= BigInt(startsAt) ? latest : null;
  if (current?.botId === botId) return { use: current.id };
  return { start: current ? messageId : startsAt };
}
