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
  /** What opened it: your message, or an event Oppenheimer told the bot for you. */
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
    const opens = message.role === 'user' || message.role === 'event';
    (opens ? block.asked : block.answer).push(message);
  }
  for (const turn of conversation.turns) blockOf(turn.id);
  return [...blocks.values()];
}

/** How long a turn ran, once it has ended; `null` for one that never started. */
export function turnDurationMs(turn: BotTurnEntity): number | null {
  if (!turn.startedAt || !turn.endedAt) return null;
  return turn.endedAt.getTime() - turn.startedAt.getTime();
}

/** A reply's paragraphs: its text split on blank lines. */
export function replyParagraphs(content: string): string[] {
  return content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

const TARGET_MAX = 80;

/**
 * What a tool call was pointed at, in one line: the first text it was given
 * (a path, a query, a command), cut short.
 */
export function toolTarget(input: Record<string, unknown>): string | undefined {
  const first = Object.values(input).find(
    (value): value is string => typeof value === 'string' && value.trim() !== '',
  );
  if (!first) return undefined;
  const line = first.trim().split('\n')[0] ?? '';
  return line.length > TARGET_MAX ? `${line.slice(0, TARGET_MAX)}…` : line;
}
