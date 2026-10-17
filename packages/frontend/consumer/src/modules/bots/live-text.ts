import type { BotConversationEntity } from './bot-conversation.entity';

/**
 * The text a bot's stream has delivered, by turn id: what was received, in
 * order, cut into segments at each reconnect. The stream drops what is
 * published while it is down, so two segments may have a hole between them.
 * Append-only; nothing here is ever corrected by a conversation read.
 */
export type BotTextBuffers = Readonly<Record<string, readonly string[]>>;

/** What a turn has written that the stored conversation does not hold yet, by turn id. */
export type BotLiveText = Readonly<Record<string, string>>;

export const NO_BOT_TEXT: BotTextBuffers = {};

/** A `text` delta, added to the end of its turn's last segment. */
export function appendBotText(
  buffers: BotTextBuffers,
  turnId: string,
  text: string,
): BotTextBuffers {
  const segments = buffers[turnId] ?? [''];
  const last = segments.length - 1;
  return { ...buffers, [turnId]: [...segments.slice(0, last), segments[last] + text] };
}

/**
 * The stream came up again: whatever arrives next may follow a hole, so it
 * starts a new segment in every turn that has text.
 */
export function markBotStreamGap(buffers: BotTextBuffers): BotTextBuffers {
  let next: Record<string, readonly string[]> | null = null;
  for (const [turnId, segments] of Object.entries(buffers)) {
    if (segments.at(-1) === '') continue;
    next ??= { ...buffers };
    next[turnId] = [...segments, ''];
  }
  return next ?? buffers;
}

/** Drops the turns the conversation shows ended. Memory only: {@link botLiveText} never draws them. */
export function forgetEndedBotTurns(
  buffers: BotTextBuffers,
  conversation: BotConversationEntity | undefined,
): BotTextBuffers {
  if (!conversation) return buffers;
  const ended = Object.keys(buffers).filter((turnId) => hasEnded(conversation, turnId));
  if (ended.length === 0) return buffers;
  const next = { ...buffers };
  for (const turnId of ended) delete next[turnId];
  return next;
}

/**
 * What to draw after the stored messages of each turn still running: a pure
 * function of what was streamed and what is stored, so a read landing early
 * or late can neither draw stored text twice nor make it blink out. A turn
 * the conversation shows ended draws nothing live; one it does not show yet
 * draws what streamed.
 */
export function botLiveText(
  buffers: BotTextBuffers,
  conversation: BotConversationEntity,
): BotLiveText {
  const live: Record<string, string> = {};
  for (const [turnId, segments] of Object.entries(buffers)) {
    if (hasEnded(conversation, turnId)) continue;
    const stored = conversation.messages
      .filter((message) => message.turnId === turnId && message.role === 'assistant')
      .map((message) => message.content);
    const suffix = liveSuffix(segments, stored);
    if (suffix) live[turnId] = suffix;
  }
  return live;
}

function hasEnded(conversation: BotConversationEntity, turnId: string): boolean {
  const turn = conversation.turn(turnId);
  return turn !== undefined && !turn.isActive;
}

/**
 * The part of one turn's streamed text that is not stored yet.
 *
 * The API stores each finished block of text as an assistant message whose
 * content is that block's deltas joined (a block of only whitespace is not
 * stored). Whitespace at a block boundary is not significant: before each
 * stored content, and before the live remainder, leading whitespace in the
 * stream is skipped, and contents are compared trimmed. Inside a block the
 * comparison is exact.
 *
 * 1. The first segment is read as starting at the turn's start: each stored
 *    content, in order, is stripped from its front, and what remains is
 *    drawn. Text after a reconnect (a later segment) is not drawn here; it
 *    follows a possible hole, and waits for the stored message that covers
 *    the hole. When the stream is behind the stored text (what remains is
 *    the start of the next content, the read landed before the last deltas),
 *    nothing is drawn: the stored message already shows it.
 * 2. Otherwise (the stream connected mid-turn, a reconnect dropped deltas, or
 *    the stored text differs from what streamed) the last segment began at
 *    an unknown point. What is drawn is what follows the furthest point in
 *    it where the last stored content ends: the end of its last whole
 *    occurrence, or the end of the longest start of the segment that is an
 *    end of that content (the segment began inside it). Taking the furthest
 *    point can only hide live text, never repeat stored text, because the
 *    true end is one of the candidates. With no such point, nothing is
 *    drawn until the next stored message gives one: guessing could double.
 */
export function liveSuffix(segments: readonly string[], storedContents: readonly string[]): string {
  const contents = storedContents.map((content) => content.trim()).filter(Boolean);
  const first = segments[0] ?? '';
  let rest = first;
  let index = 0;
  for (; index < contents.length; index++) {
    const content = contents[index] as string;
    const head = rest.trimStart();
    if (head.startsWith(content)) {
      rest = head.slice(content.length);
      continue;
    }
    if (content.startsWith(head) && segments.length === 1) return '';
    break;
  }
  if (index === contents.length) return rest.trimStart();

  const last = contents.at(-1) as string;
  const segment = segments.at(-1) ?? '';
  const end = furthestEnd(segment, last);
  return end === -1 ? '' : segment.slice(end).trimStart();
}

/** The furthest index in `segment` right after where `content` (trimmed, non-empty) can end; -1 if none. */
function furthestEnd(segment: string, content: string): number {
  const whole = segment.lastIndexOf(content);
  const wholeEnd = whole === -1 ? -1 : whole + content.length;
  const head = segment.trimStart();
  const overlap = longestPrefixThatIsSuffix(head, content);
  const overlapEnd = overlap === 0 ? -1 : segment.length - head.length + overlap;
  return Math.max(wholeEnd, overlapEnd);
}

/**
 * The length of the longest start of `text` that is also an end of `content`,
 * in linear time: the prefix function of `text` + a separator + `content`.
 */
function longestPrefixThatIsSuffix(text: string, content: string): number {
  const joined = `${text}\u0000${content}`;
  const prefix = new Array<number>(joined.length).fill(0);
  for (let i = 1; i < joined.length; i++) {
    let k = prefix[i - 1] as number;
    while (k > 0 && joined[i] !== joined[k]) k = prefix[k - 1] as number;
    if (joined[i] === joined[k]) k++;
    prefix[i] = k;
  }
  return Math.min(prefix[joined.length - 1] as number, text.length);
}
