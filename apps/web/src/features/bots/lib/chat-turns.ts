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
 * What Retry sends again: the last thing you said in the newest turn, when
 * that turn failed. Only the newest: retrying an older failure would answer
 * a question the chat has moved past.
 */
export function retryContent(blocks: readonly ChatTurnBlock[]): string | null {
  const last = blocks.at(-1);
  if (last?.turn?.status !== 'failed') return null;
  return last.asked.at(-1)?.content ?? null;
}
