import type {
  ChatStatus,
  ChatStep,
  ChatTodo,
  ChatToolCall,
  ChatToolKind,
  ChatTurn,
  SessionChat,
} from '@oppenheimer/frontend-consumer';
import type { ChatUsageContext } from '@oppenheimer/frontend-web';
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import type { FileHandOff } from './file-hand-off';

/** How a session pane reads its session: the grid, or the chat (0.7). */
export type SessionView = 'terminal' | 'chat';

/**
 * What a session pane hands its terminal about the chat: the chat its stream
 * feeds, the view the reader picked, and the chat view itself, which the
 * terminal draws over its grid without knowing what it is.
 */
export interface PaneReading {
  chat: SessionChat;
  view: SessionView;
  onViewChange: (view: SessionView) => void;
  cover: ReactNode;
  /**
   * Where the files the pane catches go while the chat shows, when its
   * composer takes files: a drop on the pane or a paste on the chat becomes
   * a chip on the next message rather than a path in the agent's prompt.
   */
  files?: FileHandOff;
}

/** What the chat's composer needs to carry files: the session they go to, and the pane's hand-off. */
export interface ChatAttach {
  sessionId: string;
  files: FileHandOff;
}

/** A file a turn changed, its line counts summed over every edit to it. */
export interface ChangedFile {
  path: string;
  additions: number;
  deletions: number;
}

/**
 * How a turn of the chat view is drawn: its steps in blocks. A run of tool
 * calls folds into one group with a verb summary ("Read 3 files, ran 2
 * commands"), the way Synara and Codex fold work; a plan is a card of its
 * own, and so are questions the agent asked, with what was answered; a turn that has settled after changing files ends on the card that
 * lists them, as Codex's does. The task list is not here: the composer keeps
 * it (`latestTodos`), because each `TodoWrite` restates the whole list.
 */
export type ChatBlock =
  | { kind: 'reply'; id: string; text: string }
  | { kind: 'thinking'; id: string; text: string; seconds: number | null }
  | { kind: 'tools'; id: string; calls: ChatToolCall[] }
  | { kind: 'plan'; id: string; call: ChatToolCall }
  | { kind: 'question'; id: string; call: ChatToolCall }
  | { kind: 'notice'; id: string; notice: 'interrupted' | 'compacted' }
  | { kind: 'changes'; id: string; files: ChangedFile[] };

export function blocksOf(turn: ChatTurn): ChatBlock[] {
  const blocks: ChatBlock[] = [];
  turn.steps.forEach((step, index) => {
    const block = blockOf(step, turn.steps[index + 1]);
    if (!block) return;
    const previous = blocks.at(-1);
    if (block.kind === 'tools' && previous?.kind === 'tools') {
      previous.calls.push(...block.calls);
      return;
    }
    blocks.push(block);
  });
  const files = turn.working ? [] : changedFiles(turn.steps);
  if (files.length > 0) blocks.push({ kind: 'changes', id: `${turn.id}:changes`, files });
  return blocks;
}

function blockOf(step: ChatStep, next: ChatStep | undefined): ChatBlock | null {
  switch (step.kind) {
    case 'reply':
      return { kind: 'reply', id: step.id, text: step.text };
    case 'thinking':
      return {
        kind: 'thinking',
        id: step.id,
        text: step.text,
        seconds: secondsBetween(step, next),
      };
    case 'notice':
      return { kind: 'notice', id: step.id, notice: step.notice };
    case 'tool':
      if (step.call.kind === 'todo') return null;
      if (step.call.kind === 'plan' && step.call.plan) {
        return { kind: 'plan', id: step.id, call: step.call };
      }
      if (step.call.kind === 'question' && step.call.questions?.length) {
        return { kind: 'question', id: step.id, call: step.call };
      }
      return { kind: 'tools', id: step.id, calls: [step.call] };
  }
}

/**
 * How long the agent thought, read off the transcript: from the thinking's
 * line to the next one. None when either has no time, or for the last step,
 * which may still be under way.
 */
function secondsBetween(step: ChatStep, next: ChatStep | undefined): number | null {
  if (!step.at || !next?.at) return null;
  return Math.max(1, Math.round((next.at.getTime() - step.at.getTime()) / 1000));
}

/** Every file the turn's edits and writes touched, in the order first touched. */
function changedFiles(steps: readonly ChatStep[]): ChangedFile[] {
  const files = new Map<string, ChangedFile>();
  for (const step of steps) {
    if (step.kind !== 'tool' || !step.call.diff || !step.call.target) continue;
    if (step.call.status === 'failed') continue;
    const file = files.get(step.call.target) ?? {
      path: step.call.target,
      additions: 0,
      deletions: 0,
    };
    file.additions += step.call.diff.additions;
    file.deletions += step.call.diff.deletions;
    files.set(file.path, file);
  }
  return [...files.values()];
}

/**
 * The questions the agent is stopped on, if any: the newest call in the
 * last turn that asks and has no answer yet. While it waits, Claude Code's
 * picker holds the terminal's input, so the chat answers it in the
 * composer's place rather than type a message into the picker.
 */
export function pendingQuestion(turn: ChatTurn | undefined): ChatToolCall | null {
  if (!turn?.working) return null;
  for (let i = turn.steps.length - 1; i >= 0; i -= 1) {
    const step = turn.steps[i];
    if (step?.kind !== 'tool' || step.call.kind !== 'question') continue;
    return step.call.status === 'running' && step.call.questions?.length ? step.call : null;
  }
  return null;
}

/** The task list the agent last wrote in a turn, which the composer keeps in reach. */
export function latestTodos(turn: ChatTurn): ChatTodo[] | null {
  for (let i = turn.steps.length - 1; i >= 0; i -= 1) {
    const step = turn.steps[i];
    if (step?.kind === 'tool' && step.call.kind === 'todo') return step.call.todos;
  }
  return null;
}

/** The model the agent last answered with, for the composer's line. */
export function latestModel(turns: readonly ChatTurn[]): string | null {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const model = turns[i]?.model;
    if (model) return model;
  }
  return null;
}

/** The window a Claude model reads by default. */
const CONTEXT_WINDOW = 200_000;
/** The long-context window, which a session past the default is on. */
const LONG_CONTEXT_WINDOW = 1_000_000;

/**
 * The context as of the agent's last answer: the CLI's own figure when its
 * status line has sent one, which knows the window the session runs with;
 * otherwise counted off the transcript, which does not, so it is the
 * default window until the tokens could only fit the long one.
 */
export function latestContext(
  turns: readonly ChatTurn[],
  status: ChatStatus | null = null,
): ChatUsageContext | null {
  if (status?.context) {
    const { usedPercent, window } = status.context;
    return { tokens: Math.round((usedPercent / 100) * window), window };
  }
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const tokens = turns[i]?.contextTokens;
    if (!tokens) continue;
    return { tokens, window: tokens > CONTEXT_WINDOW ? LONG_CONTEXT_WINDOW : CONTEXT_WINDOW };
  }
  return null;
}

/**
 * The names the conversation has used, for dictation's tidy to spell as
 * written: every file the agent touched, by its name. Read once, when a
 * recording is sent.
 */
export function chatVocabulary(turns: readonly ChatTurn[]): string[] {
  const names = new Set<string>();
  for (const turn of turns) {
    for (const step of turn.steps) {
      if (step.kind === 'tool' && step.call.target && step.call.kind !== 'command') {
        names.add(pathParts(step.call.target).name);
      }
    }
  }
  return [...names];
}

/** A tool's kind as the chat names it: a plan or a task list is never in a group. */
export type GroupKind = Exclude<ChatToolKind, 'todo' | 'plan'>;

export function groupKindOf(kind: ChatToolKind): GroupKind {
  return kind === 'todo' || kind === 'plan' ? 'other' : kind;
}

/** The order a summary names the kinds in: what was looked at, then what was changed, then the rest. */
const SUMMARY_ORDER: GroupKind[] = [
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
  const counts = new Map<GroupKind, number>();
  for (const call of calls) {
    const kind = groupKindOf(call.kind);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const parts = SUMMARY_ORDER.flatMap((kind) => {
    const count = counts.get(kind);
    return count ? [t(`sessions.chat.summary.${kind}`, { count })] : [];
  });
  const sentence = parts.join(', ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/** The one kind every call in a group shares, for its glyph; `other` when they differ. */
export function sharedKindOf(calls: readonly ChatToolCall[]): GroupKind {
  const [first, ...rest] = calls;
  if (!first) return 'other';
  const kind = groupKindOf(first.kind);
  return rest.every((call) => groupKindOf(call.kind) === kind) ? kind : 'other';
}

/** A path as the eye reads it: the file's name first, its folder after it. */
export function pathParts(path: string): { name: string; folder: string } {
  const trimmed = path.replace(/\/+$/, '');
  const slash = trimmed.lastIndexOf('/');
  return slash < 0
    ? { name: trimmed, folder: '' }
    : { name: trimmed.slice(slash + 1), folder: trimmed.slice(0, slash) };
}

/** The first line of a failure, shown under its call without opening it. */
export function firstLine(text: string | null): string | null {
  const line = text
    ?.split('\n')
    .map((part) => part.trim())
    .find(Boolean);
  return line ?? null;
}

/** A span of the chat's work as its header says it, live or settled: "48s", "1m 13s". */
export function formatChatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/** How long a settled turn ran. */
export function elapsedOf(turn: ChatTurn): string | null {
  if (!turn.startedAt || !turn.lastAt) return null;
  return formatChatElapsed(turn.lastAt.getTime() - turn.startedAt.getTime());
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
