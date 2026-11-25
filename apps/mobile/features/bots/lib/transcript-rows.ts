import type { BotConversationEntity } from '@oppenheimer/frontend-consumer';

/** The text each running turn is writing that is not stored yet, by turn id (`useBotLive`). */
type LiveText = Readonly<Record<string, string>>;

/** One line of a bot's chat as the phone draws it. */
export type TranscriptRow =
  | { kind: 'you'; key: string; text: string }
  | { kind: 'reply'; key: string; text: string; live: boolean }
  /** A run of tool calls folded to one line, and how long the turn has worked. */
  | { kind: 'work'; key: string; steps: number; ms: number | null; working: boolean }
  | { kind: 'event'; key: string; text: string };

/**
 * The chat's lines, oldest first: what you said, what the bot said, each run
 * of its tool calls folded into one "Worked for … · N steps" line, and the
 * events Oppenheimer told it for you (a compaction is bookkeeping, and is
 * left out, as the console leaves it out). A turn still writing gets its
 * streamed text (`live`) after what is stored of it.
 */
export function transcriptRows(
  conversation: BotConversationEntity,
  live: LiveText,
): TranscriptRow[] {
  const rows: TranscriptRow[] = [];
  const turns = new Map(conversation.turns.map((turn) => [turn.id, turn]));
  for (const message of conversation.messages) {
    if (message.role === 'user') {
      rows.push({ kind: 'you', key: message.id, text: message.content });
      continue;
    }
    if (message.role === 'assistant') {
      if (message.content.trim()) {
        rows.push({ kind: 'reply', key: message.id, text: message.content, live: false });
      }
      continue;
    }
    if (message.role === 'event') {
      if (message.event?.kind === 'compaction') continue;
      if (message.content.trim())
        rows.push({ kind: 'event', key: message.id, text: message.content });
      continue;
    }
    const previous = rows[rows.length - 1];
    const turn = message.turnId ? turns.get(message.turnId) : undefined;
    const started = turn?.startedAt ?? turn?.createdAt ?? null;
    const ended = turn?.endedAt ?? null;
    const ms = started && ended ? ended.getTime() - started.getTime() : null;
    const working = turn?.isActive ?? false;
    if (previous?.kind === 'work' && previous.key.startsWith(`${message.turnId ?? ''}:`)) {
      rows[rows.length - 1] = {
        ...previous,
        steps: previous.steps + message.steps.length,
        ms,
        working,
      };
      continue;
    }
    rows.push({
      kind: 'work',
      key: `${message.turnId ?? ''}:${message.id}`,
      steps: message.steps.length,
      ms,
      working,
    });
  }
  const active = conversation.activeTurn;
  const streaming = active ? live[active.id] : undefined;
  if (active && streaming?.trim()) {
    rows.push({ kind: 'reply', key: `live:${active.id}`, text: streaming, live: true });
  }
  return rows;
}
