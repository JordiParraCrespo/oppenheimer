import type { BotStreamSnapshot, BotStreamText } from '@oppenheimer/shared/schemas/bot';
import type { BotConversationEntity } from './bot-conversation.entity';

/**
 * What a bot's stream has said of one turn's text: each block it wrote, by
 * the number of blocks the turn stored before it, and the last `seq` it
 * holds. A delta at or below that `seq` is one it has.
 */
export interface BotTurnText {
  readonly seq: number;
  readonly blocks: Readonly<Record<number, string>>;
}

/** What the stream has said of each turn's text, by turn id. Never corrected by a conversation read. */
export type BotTextBuffers = Readonly<Record<string, BotTurnText>>;

/** What a turn has written that the stored conversation does not hold yet, by turn id. */
export type BotLiveText = Readonly<Record<string, string>>;

export const NO_BOT_TEXT: BotTextBuffers = {};

/** A `text` delta, added to its block; one the turn's text already holds is dropped. */
export function appendBotText(
  buffers: BotTextBuffers,
  { turnId, block, seq, text }: BotStreamText,
): BotTextBuffers {
  const held = buffers[turnId];
  if (held && seq <= held.seq) return buffers;
  const blocks = held?.blocks ?? {};
  return {
    ...buffers,
    [turnId]: { seq, blocks: { ...blocks, [block]: (blocks[block] ?? '') + text } },
  };
}

/**
 * A `snapshot`, sent as the stream comes up: the whole of the block the turn
 * is writing, in place of what was held of it (a drop may have left a hole
 * in it) and of any later one. Earlier blocks are kept for the read that
 * stores them.
 */
export function putBotSnapshot(
  buffers: BotTextBuffers,
  { turnId, block, seq, text }: BotStreamSnapshot,
): BotTextBuffers {
  const blocks: Record<number, string> = {};
  for (const [index, held] of Object.entries(buffers[turnId]?.blocks ?? {})) {
    if (Number(index) < block) blocks[Number(index)] = held;
  }
  blocks[block] = text;
  return { ...buffers, [turnId]: { seq, blocks } };
}

/** Drops the turns the conversation shows ended. Memory only: {@link botLiveText} never draws them. */
export function forgetEndedBotTurns(
  buffers: BotTextBuffers,
  conversation: BotConversationEntity | undefined,
): BotTextBuffers {
  if (!conversation) return buffers;
  const ended = Object.keys(buffers).filter((turnId) => conversation.hasEnded(turnId));
  if (ended.length === 0) return buffers;
  const next = { ...buffers };
  for (const turnId of ended) delete next[turnId];
  return next;
}

/**
 * What to draw after the stored messages of each turn still running: the
 * blocks the conversation does not hold yet. The API stores each block of
 * text that is not only whitespace as one assistant message, and numbers a
 * block by how many it stored before it, so block `n` is stored once the
 * conversation holds more than `n` of the turn's assistant messages with
 * text. A pure function of the two, so a read landing early or late can
 * neither draw stored text twice nor make it blink out. A turn the
 * conversation shows ended draws nothing live; one it does not show yet
 * draws what streamed.
 */
export function botLiveText(
  buffers: BotTextBuffers,
  conversation: BotConversationEntity,
): BotLiveText {
  const live: Record<string, string> = {};
  for (const [turnId, { blocks }] of Object.entries(buffers)) {
    if (conversation.hasEnded(turnId)) continue;
    const stored = conversation.messages.filter(
      (message) =>
        message.turnId === turnId && message.role === 'assistant' && message.content.trim() !== '',
    ).length;
    const unstored = Object.entries(blocks)
      .filter(([index]) => Number(index) >= stored)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, text]) => text.trimStart())
      .filter(Boolean);
    if (unstored.length > 0) live[turnId] = unstored.join('\n\n');
  }
  return live;
}
/** Why a running turn is waiting to try a call again, by turn id. */
export type BotLiveRetries = Readonly<Record<string, 'rate_limit' | 'unavailable'>>;

export const NO_BOT_RETRIES: BotLiveRetries = {};

/** A `retrying` event: the turn waits on the provider until it writes again. */
export function noteBotRetry(
  retries: BotLiveRetries,
  turnId: string,
  reason: 'rate_limit' | 'unavailable',
): BotLiveRetries {
  return retries[turnId] === reason ? retries : { ...retries, [turnId]: reason };
}

/** The turn wrote again (text, a message): whatever it waited on is behind it. */
export function clearBotRetry(retries: BotLiveRetries, turnId: string | null): BotLiveRetries {
  if (turnId === null || !(turnId in retries)) return retries;
  const next = { ...retries };
  delete next[turnId];
  return next;
}

/** The waits to draw: none for a turn the conversation shows ended. */
export function botLiveRetries(
  retries: BotLiveRetries,
  conversation: BotConversationEntity,
): BotLiveRetries {
  const ended = Object.keys(retries).filter((turnId) => conversation.hasEnded(turnId));
  if (ended.length === 0) return retries;
  const next = { ...retries };
  for (const turnId of ended) delete next[turnId];
  return next;
}
