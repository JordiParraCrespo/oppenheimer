import type {
  BotConversationEntity,
  BotMessageEntity,
  BotTurnEntity,
} from '@oppenheimer/frontend-consumer';

/**
 * One turn as the chat draws it: what you said, then what the bot did with
 * it. A line that belongs to no turn (a routine changed on its tab, paused or
 * failed) is a block of its own, with no turn and that one event in `asked`.
 */
export interface ChatTurnBlock {
  /** The turn's id, or the line's for one outside any turn: what React keys it by. */
  key: string;
  turnId: string | null;
  /** `undefined` only for a turn older than the page the API answered with. */
  turn: BotTurnEntity | undefined;
  /** What opened it: your message, or an event Oppenheimer told the bot for you. */
  asked: BotMessageEntity[];
  answer: BotMessageEntity[];
}

/**
 * The conversation as blocks, in the order they happened: each turn's
 * messages under it, your message apart from the bot's work, and each line
 * outside any turn as a block of its own, keyed by its id. An event opens
 * its block either way. A message waiting behind the turn under way is left
 * out: it shows on the composer until its turn starts.
 */
export function chatTurns(conversation: BotConversationEntity): ChatTurnBlock[] {
  const waiting = new Set(conversation.waitingMessages.map((message) => message.turnId));
  const blocks = new Map<string, ChatTurnBlock>();
  const blockOf = (key: string, turnId: string | null) => {
    let block = blocks.get(key);
    if (!block) {
      const turn = turnId === null ? undefined : conversation.turn(turnId);
      block = { key, turnId, turn, asked: [], answer: [] };
      blocks.set(key, block);
    }
    return block;
  };
  for (const message of conversation.messages) {
    if (message.turnId && waiting.has(message.turnId)) continue;
    const block = blockOf(message.turnId ?? message.id, message.turnId);
    const opens = message.role === 'user' || message.role === 'event';
    (opens ? block.asked : block.answer).push(message);
  }
  for (const turn of conversation.turns) if (!waiting.has(turn.id)) blockOf(turn.id, turn.id);
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
  const last = newestTurn(blocks);
  if (!last?.turn || last.turn.isActive) return null;
  const asked = last.asked.at(-1);
  // An image is sent once; a message that carried some is written again, not retried.
  if (!asked?.content || asked.attachments.length > 0) return null;
  return asked.content;
}

/** The newest block that is a turn: a routine's line after it does not take Retry away. */
export function newestTurn(blocks: readonly ChatTurnBlock[]): ChatTurnBlock | undefined {
  for (let index = blocks.length - 1; index >= 0; index--) {
    if (blocks[index]?.turnId) return blocks[index];
  }
  return undefined;
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

/** The id of the newest message you sent, which a new send replaces. */
export function newestSentId(blocks: ChatTurnBlock[]): string | undefined {
  for (let index = blocks.length - 1; index >= 0; index--) {
    const asked = blocks[index]?.asked ?? [];
    for (let at = asked.length - 1; at >= 0; at--) {
      if (asked[at]?.role === 'user') return asked[at]?.id;
    }
  }
  return undefined;
}
