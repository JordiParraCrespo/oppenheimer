import {
  type BotChannelOrigin,
  type BotTurnLane,
  type BotTurnOrigin,
  isChannelOrigin,
} from '@oppenheimer/shared';
import { BotMessageEntity, type BotPendingMedia } from './bot-message.entity';
import { maySteer } from './bot-steer.policy';
import { BotTurnEntity } from './bot-turn.entity';

/** What a channel turn takes from the bot it wakes: everything but where it runs. */
export type ChannelTurnProps = Omit<
  Parameters<typeof BotTurnEntity.queue>[0],
  'origin' | 'sourceKey' | 'lane' | 'conversationId'
>;

/**
 * The turn the owner's message on a channel queues: in the
 * owner lane, as the owner, in the chat's own conversation, opened by what
 * they wrote as their message. It is the owner's own direct chat, so it is
 * theirs as a console message is: the bot's tools and memory. The channel
 * names its origin and the key that makes the message one turn, and any
 * media the turn reads when it starts.
 *
 * Words alone are sent as a steer: written while the bot works on the chat's
 * last request, they reach it at its next tool call, so it can answer in
 * between and carry on (`takesSteer`), instead of waiting for the work to
 * end. Media waits for a turn of its own, which reads it when it starts.
 */
export function channelTurn(
  props: ChannelTurnProps,
  message: {
    origin: BotChannelOrigin;
    sourceKey: string;
    conversationId: string;
    text: string;
    pendingMedia?: BotPendingMedia | null;
  },
): { turn: BotTurnEntity; opening: BotMessageEntity } {
  const turn = BotTurnEntity.queue({
    ...props,
    conversationId: message.conversationId,
    origin: message.origin,
    lane: 'owner',
    sourceKey: message.sourceKey,
    steer: !message.pendingMedia && maySteer(true, message.text, 0),
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
    pendingMedia: message.pendingMedia ?? null,
  });
  return { turn, opening };
}

/**
 * Whether a turn sends what it writes to its chat as it goes: the owner's own
 * message on a channel. Each block of text the bot writes before it calls a
 * tool ("On it, checking your sessions") goes out then, so the person hears
 * from it at once rather than when the work is done, and the turn's end sends
 * only what came after its last call. Any other channel turn (an answer to
 * the bot's ask of another) still answers once, at its end.
 */
export function sendsAsItGoes(turn: { origin: BotTurnOrigin; lane: BotTurnLane }): boolean {
  return isChannelOrigin(turn.origin) && turn.lane === 'owner';
}

/** One stored line of a turn, as the reply at its end reads it. */
export interface ChannelTurnLine {
  role: 'assistant' | 'activity';
  content: string;
}

/**
 * The texts a channel turn's end still owes its chat, in order: every text
 * the bot wrote, or, for a turn that sent as it went (`sendsAsItGoes`), the
 * ones after its last run of tool calls, the earlier ones having gone out
 * when that run began.
 */
export function unsentTexts(lines: readonly ChannelTurnLine[], asItGoes: boolean): string[] {
  const last = asItGoes ? lines.map((line) => line.role).lastIndexOf('activity') : -1;
  return lines
    .slice(last + 1)
    .filter((line) => line.role === 'assistant')
    .map((line) => line.content);
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
 * Which conversation a message of a channel's chat belongs to: `latest` is
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
