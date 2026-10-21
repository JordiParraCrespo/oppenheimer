import type {
  ChatStep,
  ChatTodo,
  ChatToolCall,
  ChatToolKind,
  ChatTurn,
} from '@oppenheimer/frontend-consumer';
import type { TFunction } from 'i18next';

/**
 * How a turn of the chat view is drawn: its steps in blocks. A run of tool
 * calls folds into one group with a verb summary ("Read 3 files, ran 2
 * commands"), the way Synara and Codex fold work; a todo list and a plan are
 * cards of their own, and only a turn's last todo list is drawn, because each
 * `TodoWrite` restates the whole list.
 */
export type ChatBlock =
  | { kind: 'reply'; id: string; text: string }
  | { kind: 'thinking'; id: string; text: string }
  | { kind: 'tools'; id: string; calls: ChatToolCall[] }
  | { kind: 'todos'; id: string; call: ChatToolCall }
  | { kind: 'plan'; id: string; call: ChatToolCall }
  | { kind: 'notice'; id: string; notice: 'interrupted' | 'compacted' };

export function blocksOf(turn: ChatTurn): ChatBlock[] {
  const lastTodos = lastTodoStep(turn)?.id;
  const blocks: ChatBlock[] = [];
  for (const step of turn.steps) {
    const block = blockOf(step, lastTodos);
    if (!block) continue;
    const previous = blocks.at(-1);
    if (block.kind === 'tools' && previous?.kind === 'tools') {
      previous.calls.push(...block.calls);
      continue;
    }
    blocks.push(block);
  }
  return blocks;
}

function blockOf(step: ChatStep, lastTodos: string | undefined): ChatBlock | null {
  switch (step.kind) {
    case 'reply':
      return { kind: 'reply', id: step.id, text: step.text };
    case 'thinking':
      return { kind: 'thinking', id: step.id, text: step.text };
    case 'notice':
      return { kind: 'notice', id: step.id, notice: step.notice };
    case 'tool':
      if (step.call.kind === 'todo') {
        return step.id === lastTodos ? { kind: 'todos', id: step.id, call: step.call } : null;
      }
      if (step.call.kind === 'plan' && step.call.plan) {
        return { kind: 'plan', id: step.id, call: step.call };
      }
      return { kind: 'tools', id: step.id, calls: [step.call] };
  }
}

/** The task list the agent last wrote in a turn, which the composer keeps in reach. */
export function latestTodos(turn: ChatTurn): ChatTodo[] | null {
  return lastTodoStep(turn)?.call.todos ?? null;
}

function lastTodoStep(turn: ChatTurn): Extract<ChatStep, { kind: 'tool' }> | undefined {
  for (let i = turn.steps.length - 1; i >= 0; i -= 1) {
    const step = turn.steps[i];
    if (step?.kind === 'tool' && step.call.kind === 'todo') return step;
  }
  return undefined;
}

/** The order a summary names the kinds in: what was looked at, then what was changed, then the rest. */
type SummaryKind = Exclude<ChatToolKind, 'todo' | 'plan'>;

const SUMMARY_ORDER: SummaryKind[] = [
  'read',
  'search',
  'web',
  'edit',
  'write',
  'command',
  'agent',
  'mcp',
  'question',
  'other',
];

/** "Read 3 files, searched 2 patterns, ran 2 commands"; the failures are the group's `failed`. */
export function summaryOf(calls: readonly ChatToolCall[], t: TFunction): string {
  const counts = new Map<ChatToolKind, number>();
  for (const call of calls) counts.set(call.kind, (counts.get(call.kind) ?? 0) + 1);
  const parts = SUMMARY_ORDER.flatMap((kind) => {
    const count = counts.get(kind);
    return count ? [t(`sessions.chat.summary.${kind}`, { count })] : [];
  });
  const sentence = parts.join(', ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/** How long a turn ran, as the header says it: "48s", "1m 13s". */
export function elapsedOf(turn: ChatTurn): string | null {
  if (!turn.startedAt || !turn.lastAt) return null;
  const seconds = Math.max(
    0,
    Math.round((turn.lastAt.getTime() - turn.startedAt.getTime()) / 1000),
  );
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/**
 * A model id as people say it: `claude-opus-5-5` reads "Opus 5.5". Anything
 * that is not a Claude id is shown as it came.
 */
export function modelName(model: string | null): string | null {
  if (!model) return null;
  const match = /^claude-([a-z]+)-(\d+)(?:-(\d+))?/.exec(model);
  if (!match) return model;
  const [, family = '', major, minor] = match;
  return `${family.charAt(0).toUpperCase()}${family.slice(1)} ${major}${minor ? `.${minor}` : ''}`;
}

/** Text the chat's composer sends the agent: pasted as one block, then Enter. */
export const PASTE_START = '\u001b[200~';
export const PASTE_END = '\u001b[201~';
/** The key that stops Claude Code's turn. */
export const INTERRUPT = '\u001b';
