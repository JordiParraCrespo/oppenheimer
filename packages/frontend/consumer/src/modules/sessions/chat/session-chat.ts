/**
 * A session's conversation read as a chat (`product/next-steps/0.7-terminal-and-chat.md`):
 * the entries of the agent's own transcript, which the runner follows beside
 * the terminal and the relay hands over as they came (`attachment.chat`), put
 * into turns of typed steps the console can draw as cards.
 *
 * The agent still runs in its terminal, unmodified, and the terminal stays
 * the way to drive it: this is a second reading of the same conversation, so
 * nothing here is ever sent back. The entries keep Claude Code's own
 * transcript names (`type`, `message.content`, `tool_use`, `tool_result`),
 * read loosely, because that shape is the CLI's and moves with its versions;
 * a line this does not recognise is skipped, never an error.
 */

/** What a tool call is, for the card it gets; Claude's tools are classified, not listed. */
export type ChatToolKind =
  | 'command'
  | 'read'
  | 'edit'
  | 'write'
  | 'search'
  | 'web'
  | 'todo'
  | 'agent'
  | 'plan'
  | 'question'
  | 'mcp'
  | 'other';

export type ChatTodoStatus = 'pending' | 'in_progress' | 'completed';

export interface ChatTodo {
  content: string;
  status: ChatTodoStatus;
}

export interface ChatToolCall {
  id: string;
  /** The tool's own name (`Bash`, `Edit`, `mcp__github__get_issue`). */
  name: string;
  kind: ChatToolKind;
  /** What it acted on, in a line: a path, a command, a pattern, a URL. */
  target: string | null;
  /** What it was asked to do in words, when it says (a command's description, a subagent's task). */
  description: string | null;
  /** `running` until its result is in the transcript. */
  status: 'running' | 'done' | 'failed';
  output: string | null;
  /** Lines an edit adds and removes, counted off its old and new text. */
  diff: { additions: number; deletions: number } | null;
  todos: ChatTodo[] | null;
  /** The plan text `ExitPlanMode` proposes. */
  plan: string | null;
  /** The host cut the call's input or its output to keep the entry small. */
  truncated: boolean;
}

export type ChatStep =
  | { kind: 'reply'; id: string; text: string; truncated: boolean }
  | { kind: 'thinking'; id: string; text: string }
  | { kind: 'tool'; id: string; call: ChatToolCall }
  | { kind: 'notice'; id: string; notice: 'interrupted' | 'compacted' };

export interface ChatPrompt {
  id: string;
  text: string;
  /** Images and documents pasted with it, named and never sent. */
  files: number;
  at: Date | null;
}

export interface ChatTurn {
  id: string;
  /** What the person sent; none for the work before the first prompt. */
  prompt: ChatPrompt | null;
  steps: ChatStep[];
  model: string | null;
  startedAt: Date | null;
  lastAt: Date | null;
  /** The last turn, while the agent has not answered in words or a call is open. */
  working: boolean;
}

export interface ChatState {
  /** The host follows this session's transcript: a first batch has arrived. */
  available: boolean;
  turns: ChatTurn[];
}

export interface ChatBatch {
  reset?: boolean;
  entries: readonly string[];
}

const EMPTY: ChatState = { available: false, turns: [] };

/**
 * One attachment's chat: batches in, an immutable `ChatState` out, with a
 * subscription a React store can read (`useSyncExternalStore`). A reset
 * starts over, which is what a reconnect's new attachment sends first.
 */
export class SessionChat {
  private entries: unknown[] = [];
  private state: ChatState = EMPTY;
  private readonly listeners = new Set<() => void>();

  apply(batch: ChatBatch): void {
    if (batch.reset) this.entries = [];
    for (const raw of batch.entries) {
      try {
        this.entries.push(JSON.parse(raw));
      } catch {
        // A line the host sent that is not JSON is the host's bug; skip it.
      }
    }
    this.state = { available: true, turns: toTurns(this.entries) };
    for (const listener of this.listeners) listener();
  }

  snapshot = (): ChatState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}

type Loose = Record<string, unknown>;

function record(value: unknown): Loose | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Loose)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function date(value: unknown): Date | null {
  const s = text(value);
  if (!s) return null;
  const at = new Date(s);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** The entries in turns: a turn opens at each prompt the person typed. */
export function toTurns(entries: readonly unknown[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  const calls = new Map<string, ChatToolCall>();
  let turn: ChatTurn | null = null;
  const open = (prompt: ChatPrompt | null, id: string, at: Date | null): ChatTurn => {
    const next: ChatTurn = {
      id,
      prompt,
      steps: [],
      model: null,
      startedAt: at,
      lastAt: at,
      working: false,
    };
    turns.push(next);
    return next;
  };

  entries.forEach((value, index) => {
    const entry = record(value);
    const message = record(entry?.message);
    if (!entry || !message || entry.isSidechain === true) return;
    const id = text(entry.uuid) ?? `entry-${index}`;
    const at = date(entry.timestamp);
    const content = message.content;

    if (entry.type === 'user') {
      if (entry.isCompactSummary === true) {
        turn ??= open(null, id, at);
        turn.steps.push({ kind: 'notice', id, notice: 'compacted' });
        return;
      }
      const blocks = Array.isArray(content) ? content.map(record) : null;
      // A tool's result rides a user line: it is the agent's turn, not the person's.
      for (const block of blocks ?? []) {
        if (block?.type !== 'tool_result') continue;
        const call = calls.get(String(block.tool_use_id));
        if (!call) continue;
        call.status = block.is_error === true ? 'failed' : 'done';
        call.output = text(block.content);
        call.truncated ||= block.truncated === true;
      }
      if (entry.isMeta === true) return;
      const typed = typedPrompt(
        typeof content === 'string'
          ? content
          : (blocks ?? [])
              .filter((block) => block?.type === 'text')
              .map((block) => String(block?.text ?? ''))
              .join('\n'),
      );
      if (typed === 'interrupted') {
        turn ??= open(null, id, at);
        turn.steps.push({ kind: 'notice', id, notice: 'interrupted' });
        return;
      }
      if (typed === null) return;
      const files = (blocks ?? []).filter(
        (block) => block?.type === 'image' || block?.type === 'document',
      ).length;
      turn = open({ id, text: typed, files, at }, id, at);
      return;
    }

    if (entry.type !== 'assistant' || !Array.isArray(content)) return;
    turn ??= open(null, id, at);
    turn.model = text(message.model) ?? turn.model;
    if (at) turn.lastAt = at;
    content.forEach((raw, position) => {
      const block = record(raw);
      if (!block || !turn) return;
      const stepId = `${id}:${position}`;
      if (block.type === 'text' && text(block.text)) {
        turn.steps.push({
          kind: 'reply',
          id: stepId,
          text: String(block.text),
          truncated: block.truncated === true,
        });
      } else if (block.type === 'thinking' && text(block.thinking)) {
        turn.steps.push({ kind: 'thinking', id: stepId, text: String(block.thinking) });
      } else if (block.type === 'tool_use') {
        const call = toolCall(block);
        calls.set(call.id, call);
        turn.steps.push({ kind: 'tool', id: stepId, call });
      }
    });
  });

  const last = turns.at(-1);
  if (last) {
    const tail = last.steps.at(-1);
    last.working =
      last.steps.some((step) => step.kind === 'tool' && step.call.status === 'running') ||
      tail === undefined ||
      (tail.kind !== 'reply' && tail.kind !== 'notice');
  }
  return turns;
}

/**
 * The person's words as they typed them, `null` for a line that is the CLI's
 * own (a caveat, a command's output), or `interrupted` for the note Claude
 * Code writes when the person stops a turn. A slash command is written as
 * tags; it reads as `/name arguments`.
 */
function typedPrompt(raw: string): string | 'interrupted' | null {
  const value = raw.trim();
  if (value === '') return null;
  if (value.startsWith('[Request interrupted')) return 'interrupted';
  if (
    value.startsWith('Caveat:') ||
    value.startsWith('<local-command-') ||
    value.startsWith('<bash-stdout') ||
    value.startsWith('<bash-stderr') ||
    value.startsWith('<system-reminder>')
  ) {
    return null;
  }
  if (value.startsWith('<command-')) {
    const name = /<command-name>([^<]*)<\/command-name>/.exec(value)?.[1]?.trim() ?? '';
    const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(value)?.[1]?.trim() ?? '';
    const typed = [name, args].filter(Boolean).join(' ');
    return typed === '' ? null : typed;
  }
  if (value.startsWith('<bash-input>')) {
    return `! ${value.replace(/<\/?bash-input>/g, '').trim()}`;
  }
  return value;
}

const KINDS: Record<string, ChatToolKind> = {
  Bash: 'command',
  BashOutput: 'command',
  KillShell: 'command',
  Read: 'read',
  NotebookRead: 'read',
  Edit: 'edit',
  MultiEdit: 'edit',
  NotebookEdit: 'edit',
  Write: 'write',
  Grep: 'search',
  Glob: 'search',
  LS: 'search',
  WebFetch: 'web',
  WebSearch: 'web',
  TodoWrite: 'todo',
  Task: 'agent',
  Agent: 'agent',
  ExitPlanMode: 'plan',
  AskUserQuestion: 'question',
};

function toolCall(block: Loose): ChatToolCall {
  const name = text(block.name) ?? 'tool';
  const input = record(block.input) ?? {};
  const kind = KINDS[name] ?? (name.startsWith('mcp__') ? 'mcp' : 'other');
  const field = (...keys: string[]) => {
    for (const key of keys) {
      const value = text(input[key]);
      if (value) return value;
    }
    return null;
  };
  return {
    id: text(block.id) ?? name,
    name,
    kind,
    target:
      kind === 'command'
        ? field('command', 'bash_id', 'shell_id')
        : kind === 'search'
          ? field('pattern', 'path')
          : kind === 'web'
            ? field('url', 'query')
            : kind === 'agent'
              ? field('subagent_type', 'description')
              : field('file_path', 'notebook_path', 'path', 'url', 'query', 'command'),
    description: field('description', 'prompt'),
    status: 'running',
    output: null,
    diff: kind === 'edit' || kind === 'write' ? diffOf(name, input) : null,
    todos: kind === 'todo' ? todosOf(input.todos) : null,
    plan: kind === 'plan' ? field('plan') : null,
    truncated: block.truncated === true,
  };
}

const lines = (value: unknown): number =>
  typeof value === 'string' && value.length > 0 ? value.split('\n').length : 0;

function diffOf(name: string, input: Loose): { additions: number; deletions: number } {
  if (name === 'Write') return { additions: lines(input.content), deletions: 0 };
  const edits = Array.isArray(input.edits) ? input.edits.map(record) : [input];
  return edits.reduce(
    (sum: { additions: number; deletions: number }, edit) => ({
      additions: sum.additions + lines(edit?.new_string ?? edit?.new_source),
      deletions: sum.deletions + lines(edit?.old_string),
    }),
    { additions: 0, deletions: 0 },
  );
}

function todosOf(value: unknown): ChatTodo[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    const todo = record(raw);
    const content = text(todo?.content);
    if (!content) return [];
    const status: ChatTodoStatus =
      todo?.status === 'completed' || todo?.status === 'in_progress' ? todo.status : 'pending';
    return [{ content, status }];
  });
}
