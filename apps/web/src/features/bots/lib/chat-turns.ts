import type {
  BotConversationEntity,
  BotMessageEntity,
  BotTurnEntity,
} from '@oppenheimer/frontend-consumer';

/** One turn as the chat draws it: what you said, then what the bot did with it. */
export interface ChatTurnBlock {
  turnId: string;
  /** `undefined` only for a turn older than the page the API answered with. */
  turn: BotTurnEntity | undefined;
  asked: BotMessageEntity[];
  answer: BotMessageEntity[];
}

/** The conversation as turns, in the order they were sent. */
export function chatTurns(conversation: BotConversationEntity): ChatTurnBlock[] {
  const blocks = new Map<string, ChatTurnBlock>();
  const blockOf = (turnId: string) => {
    let block = blocks.get(turnId);
    if (!block) {
      block = { turnId, turn: conversation.turn(turnId), asked: [], answer: [] };
      blocks.set(turnId, block);
    }
    return block;
  };
  for (const message of conversation.messages) {
    const block = blockOf(message.turnId);
    (message.role === 'user' ? block.asked : block.answer).push(message);
  }
  for (const turn of conversation.turns) blockOf(turn.id);
  return [...blocks.values()];
}

/** How long a turn ran, once it has ended; `null` for one that never started. */
export function turnDurationMs(turn: BotTurnEntity): number | null {
  if (!turn.startedAt || !turn.endedAt) return null;
  return turn.endedAt.getTime() - turn.startedAt.getTime();
}

/**
 * Where a turn is, as the chat says it: `queued` (waiting for its turn),
 * `thinking` (running, nothing on screen yet), `working` (running, something
 * on screen), or how it ended.
 */
export type TurnPhase = 'queued' | 'thinking' | 'working' | 'completed' | 'cancelled' | 'failed';

/** A turn's phase; `wrote` is whether anything of it is on screen yet (a reply, a tool call, live text). */
export function turnPhase(turn: BotTurnEntity, wrote: boolean): TurnPhase {
  if (turn.status === 'queued') return 'queued';
  if (turn.status === 'running') return wrote ? 'working' : 'thinking';
  return turn.status;
}

/** What the bot said in a turn, as one text to copy: its replies, a blank line apart. */
export function replyText(block: ChatTurnBlock): string {
  return block.answer
    .filter((message) => message.role === 'assistant')
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join('\n\n');
}

/**
 * What Retry sends again: the last thing you said in the newest turn, once
 * that turn has ended (answered, stopped or failed). Only the newest:
 * retrying an older one would answer a question the chat has moved past.
 */
export function retryContent(blocks: readonly ChatTurnBlock[]): string | null {
  const last = blocks.at(-1);
  if (!last?.turn || last.turn.isActive) return null;
  return last.asked.at(-1)?.content ?? null;
}

/** A token count the way the trail prints it: "840", "3.1k", "12k". */
export function compactTokens(count: number): string {
  if (count < 1000) return String(count);
  const thousands = count / 1000;
  return `${thousands < 10 ? thousands.toFixed(1).replace(/\.0$/, '') : Math.round(thousands)}k`;
}

/** When a turn was asked: your first message in it, else the turn's own start. */
function askedAt(block: ChatTurnBlock): Date | undefined {
  return block.asked[0]?.createdAt ?? block.turn?.createdAt;
}

/**
 * The markers before a turn (AI Elements' Marker): the day, when it is not
 * the day the turn before was asked on; the model, when the turn runs on
 * another than the turn before. The first turn has neither.
 */
export function markersBefore(
  blocks: readonly ChatTurnBlock[],
  index: number,
): { day: Date | null; model: BotTurnEntity | null } {
  const block = blocks[index];
  const previous = index > 0 ? blocks[index - 1] : undefined;
  if (!block || !previous) return { day: null, model: null };
  const at = askedAt(block);
  const before = askedAt(previous);
  const day = at && before && at.toDateString() !== before.toDateString() ? at : null;
  const { turn } = block;
  const prior = previous.turn;
  const model =
    turn && prior && (turn.model !== prior.model || turn.provider !== prior.provider) ? turn : null;
  return { day, model };
}
