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

import { type ChatAnswer, questionKeys } from './question-keys';

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

/** One question `AskUserQuestion` puts to the person, as the agent wrote it. */
export interface ChatQuestion {
  /** The chip over it in the terminal ("Scope"). */
  header: string | null;
  question: string;
  /** Several options may be picked. */
  multiSelect: boolean;
  options: { label: string; description: string | null }[];
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
  /** What `AskUserQuestion` asks, in order. */
  questions: ChatQuestion[] | null;
  /**
   * The answers, by question, once they are in: read off the result's text,
   * since the host sends the words and not the CLI's own record of them.
   * Empty when the text could not be read; none while it waits.
   */
  answers: Record<string, string> | null;
  /** The host cut the call's input or its output to keep the entry small. */
  truncated: boolean;
  /** When the agent made the call, and when its result landed (none while it runs). */
  startedAt: Date | null;
  finishedAt: Date | null;
}

/** `at` is when the agent wrote the step, from its transcript line. */
export type ChatStep =
  | { kind: 'reply'; id: string; at: Date | null; text: string; truncated: boolean }
  | { kind: 'thinking'; id: string; at: Date | null; text: string }
  | { kind: 'tool'; id: string; at: Date | null; call: ChatToolCall }
  | { kind: 'notice'; id: string; at: Date | null; notice: 'interrupted' | 'compacted' };

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
  /**
   * How many tokens the agent's context held at its last answer in the turn:
   * what it was sent, cached or not, and what it wrote. None from a host
   * that does not send the counts.
   */
  contextTokens: number | null;
  startedAt: Date | null;
  lastAt: Date | null;
  /** The last turn, while the agent has not answered in words or a call is open. */
  working: boolean;
}

/** One of the plan's usage windows: the share used, 0–100, and when it resets. */
export interface ChatLimit {
  usedPercent: number;
  resetsAt: Date | null;
}

/**
 * The figures Claude Code hands its status line, which the runner sends
 * beside the transcript (`oppenheimer.status` entries): how full the context
 * is, by the CLI's own count, and the plan's 5-hour and weekly windows. Each
 * part is absent until the CLI sends it, and the windows never come for an
 * account on an API key.
 */
export interface ChatStatus {
  context: { usedPercent: number; window: number } | null;
  fiveHour: ChatLimit | null;
  sevenDay: ChatLimit | null;
}

/** A message written while the agent worked, waiting for its turn to end. */
export interface ChatQueued {
  id: string;
  text: string;
}

export interface ChatState {
  /** The host follows this session's transcript: a first batch has arrived. */
  available: boolean;
  turns: ChatTurn[];
  /** What waits to be sent, in order; the first goes once the agent settles. */
  queued: readonly ChatQueued[];
  /** The latest status the host sent, if any. */
  status: ChatStatus | null;
}

export interface ChatBatch {
  reset?: boolean;
  entries: readonly string[];
}

const EMPTY: ChatState = { available: false, turns: [], queued: [], status: null };

/** The entry the runner adds for the status line's figures. */
const STATUS_ENTRY = 'oppenheimer.status';

/** Several lines go to the agent as one bracketed paste, so a newline in them is not Enter. */
const PASTE_START = '\u001b[200~';
const PASTE_END = '\u001b[201~';
/** The key that stops Claude Code's turn. */
const ESCAPE = '\u001b';
/** How long the agent's prompt takes the text before Enter submits it. */
const SUBMIT_AFTER_TEXT_MS = 60;
/**
 * The gap between the keys that answer a question: the picker redraws after
 * each one and reads the next against what it drew.
 */
const QUESTION_KEY_GAP_MS = 120;
/**
 * How long a queued message that went waits for its turn to show before
 * the next may go: a message that opens no turn (a slash command the CLI
 * answers itself) must not hold the rest of the queue.
 */
const QUEUE_SETTLE_MS = 5000;

/**
 * One attachment's chat: batches in, an immutable `ChatState` out, with a
 * subscription a React store can read (`useSyncExternalStore`), and the way
 * back to the agent, which is its terminal. A reset starts over, which is
 * what a reconnect's new attachment sends first. Whoever holds the stream
 * feeds it (`apply`) and lends it the stream's input (`connect`); the view
 * reads it and types through it without knowing there is a stream.
 */
export class SessionChat {
  private entries: unknown[] = [];
  /**
   * The turns a later prompt has closed, built once and kept by identity: a
   * batch rebuilds only the open turn, so a long conversation costs each
   * line the length of its last turn, not of the whole transcript.
   */
  private closed: ChatTurn[] = [];
  /** The calls in those turns, to notice a result that lands on one. */
  private closedCalls = new Set<string>();
  /** The entry the open turn starts at. */
  private openFrom = 0;
  private type: ((data: string) => void) | null = null;
  private state: ChatState = EMPTY;
  private readonly listeners = new Set<() => void>();
  /** The last queued message sent: how many turns there were, and when. */
  private sentQueued: { turns: number; at: number } | null = null;
  /**
   * The turn the queue was started during. Nothing goes until it is in the
   * chat again and has ended: a reconnect replays the history in several
   * batches, and one that ends on an older, settled turn is not the agent
   * being free.
   */
  private queuedDuring: string | null = null;
  private queuedIds = 0;

  apply(batch: ChatBatch): void {
    if (batch.reset) {
      this.entries = [];
      this.reopen();
    }
    const from = this.entries.length;
    let status = this.state.status;
    for (const raw of batch.entries) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // A line the host sent that is not JSON is the host's bug; skip it.
        continue;
      }
      // The status is the latest one, not a line of the conversation.
      if (record(parsed)?.type === STATUS_ENTRY) status = statusOf(parsed);
      else this.entries.push(parsed);
    }
    // A result for a call a closed turn made (a background command that
    // finished after the next prompt) changes that turn: build them all again.
    if (this.entries.slice(from).some((entry, i) => this.answersClosed(entry, from + i))) {
      this.reopen();
    }
    const { turns, starts } = buildTurns(this.entries, this.openFrom);
    const open = turns.length - 1;
    for (const turn of turns.slice(0, Math.max(0, open))) {
      this.closed.push(turn);
      for (const step of turn.steps) if (step.kind === 'tool') this.closedCalls.add(step.call.id);
    }
    if (open > 0) this.openFrom = starts[open] ?? this.openFrom;
    const last = turns[open];
    this.publish({
      ...this.state,
      available: true,
      turns: last ? [...this.closed, last] : [...this.closed],
      status,
    });
    this.flush();
  }

  private publish(state: ChatState): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }

  /** The agent is in a turn: a message now would interrupt the work it is doing. */
  private busy(): boolean {
    return this.state.turns.at(-1)?.working === true;
  }

  /**
   * A message from the composer: sent now when the agent is free, queued
   * while it works, to go when its turn ends. Claude Code would queue a
   * message typed mid-turn too, but out of sight; this keeps it in the chat,
   * where it can still be edited, sent now or taken back.
   */
  post(message: string): void {
    const text = message.trim();
    if (text === '') return;
    if (!this.busy()) {
      this.send(message);
      return;
    }
    this.queuedIds += 1;
    if (this.state.queued.length === 0) this.queuedDuring = this.state.turns.at(-1)?.id ?? null;
    this.publish({
      ...this.state,
      queued: [...this.state.queued, { id: `queued-${this.queuedIds}`, text: message }],
    });
  }

  /** Takes a queued message back, for the composer to edit or to drop; its text, if it was there. */
  unqueue(id: string): string | null {
    const held = this.state.queued.find((queued) => queued.id === id);
    if (!held) return null;
    this.publish({ ...this.state, queued: this.state.queued.filter((queued) => queued !== held) });
    return held.text;
  }

  /** Sends a queued message at once, into the turn under way, as the terminal would take it. */
  sendQueued(id: string): void {
    if (!this.type) return;
    const text = this.unqueue(id);
    if (text !== null) this.send(text);
  }

  /**
   * Sends the first queued message once the agent has settled, and the next
   * only after that one has opened its turn (or `QUEUE_SETTLE_MS`), so two
   * never go into the same moment.
   */
  private flush(): void {
    const [next, ...rest] = this.state.queued;
    if (!next || !this.type || this.busy()) return;
    const during = this.queuedDuring;
    if (during && !this.state.turns.some((turn) => turn.id === during)) return;
    this.queuedDuring = null;
    const waiting = this.sentQueued;
    if (
      waiting &&
      this.state.turns.length <= waiting.turns &&
      Date.now() - waiting.at < QUEUE_SETTLE_MS
    ) {
      return;
    }
    this.sentQueued = { turns: this.state.turns.length, at: Date.now() };
    this.publish({ ...this.state, queued: rest });
    this.send(next.text);
    if (rest.length > 0) setTimeout(() => this.flush(), QUEUE_SETTLE_MS);
  }

  private reopen(): void {
    this.closed = [];
    this.closedCalls.clear();
    this.openFrom = 0;
  }

  private answersClosed(entry: unknown, index: number): boolean {
    if (this.closedCalls.size === 0) return false;
    const reading = classify(entry, index);
    return (
      reading?.kind === 'results' &&
      reading.results.some((result) => this.closedCalls.has(result.toolUseId))
    );
  }

  /** Lends the chat a way to type into the session's PTY; the function returned takes it back. */
  connect(type: (data: string) => void): () => void {
    this.type = type;
    return () => {
      if (this.type === type) this.type = null;
    };
  }

  /**
   * A message for the agent, typed the way a person would type it into the
   * terminal: a line as it is, several lines as one paste, then Enter. The
   * chat never reaches the agent any way the terminal could not.
   *
   * `withFiles` says the message's files are already in the prompt (their
   * paths, pasted by the host), so the words may be empty: Enter alone sends
   * the files. Waiting for those paths is the caller's, who sent them.
   */
  send(message: string, { withFiles = false }: { withFiles?: boolean } = {}): void {
    const type = this.type;
    const empty = message.trim() === '';
    if (!type || (empty && !withFiles)) return;
    if (!empty) type(message.includes('\n') ? `${PASTE_START}${message}${PASTE_END}` : message);
    setTimeout(() => type('\r'), SUBMIT_AFTER_TEXT_MS);
  }

  /**
   * Answers the questions the agent is waiting on (`AskUserQuestion`), with
   * the keys its picker takes (`questionKeys`), one at a time. False when
   * nothing is connected to type them, so the answers were not sent.
   */
  answer(questions: readonly ChatQuestion[], answers: readonly ChatAnswer[]): boolean {
    const type = this.type;
    if (!type) return false;
    questionKeys(questions, answers).forEach((key, index) => {
      setTimeout(() => type(key), index * QUESTION_KEY_GAP_MS);
    });
    return true;
  }

  /** Stops the agent's turn: Escape, as in its terminal. */
  interrupt(): void {
    this.type?.(ESCAPE);
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

/**
 * What one transcript entry is, for the turn loop: a prompt the person typed
 * (it opens a turn), the agent's steps, tool results to pair with their
 * calls, or nothing the chat shows. Pure: one entry in, one reading out.
 */
type Reading =
  | { kind: 'prompt'; prompt: ChatPrompt }
  | {
      kind: 'steps';
      steps: ChatStep[];
      model: string | null;
      at: Date | null;
      contextTokens?: number | null;
    }
  | { kind: 'results'; results: ChatResult[]; at: Date | null }
  /** A command the CLI answered itself (`/cost`): its output ends the turn it opened. */
  | { kind: 'answered'; at: Date | null }
  | null;

interface ChatResult {
  toolUseId: string;
  failed: boolean;
  output: string | null;
  truncated: boolean;
}

export function classify(value: unknown, index: number): Reading {
  const entry = record(value);
  const message = record(entry?.message);
  if (!entry || !message || entry.isSidechain === true) return null;
  const id = text(entry.uuid) ?? `entry-${index}`;
  const at = date(entry.timestamp);
  const content = message.content;

  if (entry.type === 'assistant') {
    if (!Array.isArray(content)) return null;
    const steps = content.flatMap((raw, position) => {
      const step = stepOf(record(raw), `${id}:${position}`, at);
      return step ? [step] : [];
    });
    return {
      kind: 'steps',
      steps,
      model: text(message.model),
      at,
      contextTokens: contextOf(message.usage),
    };
  }
  if (entry.type !== 'user') return null;
  if (entry.isCompactSummary === true) {
    return {
      kind: 'steps',
      steps: [{ kind: 'notice', id, at, notice: 'compacted' }],
      model: null,
      at,
    };
  }
  const blocks = Array.isArray(content) ? content.map(record) : [];
  // A tool's result rides a user line: it is the agent's turn, not the person's.
  const results = blocks.flatMap((block): ChatResult[] =>
    block?.type === 'tool_result'
      ? [
          {
            toolUseId: String(block.tool_use_id),
            failed: block.is_error === true,
            output: text(block.content),
            truncated: block.truncated === true,
          },
        ]
      : [],
  );
  if (results.length > 0) return { kind: 'results', results, at };
  if (entry.isMeta === true) return null;
  if (typeof content === 'string' && /^\s*<local-command-std(out|err)>/.test(content)) {
    return { kind: 'answered', at };
  }
  const typed = typedPrompt(
    typeof content === 'string'
      ? content
      : blocks
          .filter((block) => block?.type === 'text')
          .map((block) => String(block?.text ?? ''))
          .join('\n'),
  );
  if (typed === 'interrupted') {
    return {
      kind: 'steps',
      steps: [{ kind: 'notice', id, at, notice: 'interrupted' }],
      model: null,
      at,
    };
  }
  if (typed === null) return null;
  const files = blocks.filter(
    (block) => block?.type === 'image' || block?.type === 'document',
  ).length;
  return { kind: 'prompt', prompt: { id, text: typed, files, at } };
}

function stepOf(block: Loose | null, id: string, at: Date | null): ChatStep | null {
  if (block?.type === 'text' && text(block.text)) {
    return { kind: 'reply', id, at, text: String(block.text), truncated: block.truncated === true };
  }
  if (block?.type === 'thinking' && text(block.thinking)) {
    return { kind: 'thinking', id, at, text: String(block.thinking) };
  }
  if (block?.type === 'tool_use')
    return { kind: 'tool', id, at, call: { ...toolCall(block), startedAt: at } };
  return null;
}

/** The entries in turns: a turn opens at each prompt the person typed. */
export function toTurns(entries: readonly unknown[]): ChatTurn[] {
  return buildTurns(entries, 0).turns;
}

/**
 * The turns from entry `from` on, with the entry each one starts at. `from`
 * is where a turn starts (a prompt), or the first entry.
 */
function buildTurns(
  entries: readonly unknown[],
  from: number,
): { turns: ChatTurn[]; starts: number[] } {
  const turns: ChatTurn[] = [];
  const starts: number[] = [];
  const calls = new Map<string, ChatToolCall>();
  const answered = new Set<ChatTurn>();
  const current = (id: string, at: Date | null, index: number): ChatTurn => {
    const last = turns.at(-1);
    if (last) return last;
    starts.push(index);
    return open(turns, null, id, at);
  };

  for (let index = from; index < entries.length; index += 1) {
    const reading = classify(entries[index], index);
    if (!reading) continue;
    switch (reading.kind) {
      case 'prompt':
        starts.push(index);
        open(turns, reading.prompt, reading.prompt.id, reading.prompt.at);
        continue;
      case 'steps': {
        const turn = current(reading.steps[0]?.id ?? `entry-${index}`, reading.at, index);
        turn.model = reading.model ?? turn.model;
        turn.contextTokens = reading.contextTokens ?? turn.contextTokens;
        if (reading.at) turn.lastAt = reading.at;
        for (const step of reading.steps) {
          if (step.kind === 'tool') calls.set(step.call.id, step.call);
          turn.steps.push(step);
        }
        continue;
      }
      case 'answered': {
        const turn = turns.at(-1);
        if (turn) {
          answered.add(turn);
          if (reading.at) turn.lastAt = reading.at;
        }
        continue;
      }
      case 'results':
        for (const result of reading.results) {
          const call = calls.get(result.toolUseId);
          if (!call) continue;
          call.status = result.failed ? 'failed' : 'done';
          call.output = result.output;
          if (call.questions && !result.failed) call.answers = answersOf(result.output);
          call.truncated ||= result.truncated;
          call.finishedAt = reading.at;
        }
        continue;
    }
  }

  const last = turns.at(-1);
  if (last) last.working = !answered.has(last) && isWorking(last);
  return { turns, starts };
}

function open(turns: ChatTurn[], prompt: ChatPrompt | null, id: string, at: Date | null): ChatTurn {
  const turn: ChatTurn = {
    id,
    prompt,
    steps: [],
    model: null,
    contextTokens: null,
    startedAt: at,
    lastAt: at,
    working: false,
  };
  turns.push(turn);
  return turn;
}

/** The last turn is the agent's while a call is open or it has not answered in words. */
function isWorking(turn: ChatTurn): boolean {
  const tail = turn.steps.at(-1);
  if (tail === undefined) return true;
  if (turn.steps.some((step) => step.kind === 'tool' && step.call.status === 'running'))
    return true;
  return tail.kind !== 'reply' && tail.kind !== 'notice';
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
    questions: kind === 'question' ? questionsOf(input.questions) : null,
    answers: null,
    truncated: block.truncated === true,
    startedAt: null,
    finishedAt: null,
  };
}

/**
 * The tokens an answer's context held, off its `usage`: what it was sent,
 * whether read from the cache or written to it. Its output is left out, as
 * Claude Code's own count leaves it out.
 */
function contextOf(value: unknown): number | null {
  const usage = record(value);
  if (!usage) return null;
  const count = (key: string) => {
    const n = usage[key];
    return typeof n === 'number' && Number.isFinite(n) ? n : 0;
  };
  const total =
    count('input_tokens') + count('cache_creation_input_tokens') + count('cache_read_input_tokens');
  return total > 0 ? total : null;
}

/** A share the CLI sent, as a number from 0 to 100, or none. */
function percentOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : null;
}

function limitOf(value: unknown): ChatLimit | null {
  const window = record(value);
  const usedPercent = percentOf(window?.used_percentage);
  if (usedPercent === null) return null;
  const resets = window?.resets_at;
  return {
    usedPercent,
    resetsAt: typeof resets === 'number' && resets > 0 ? new Date(resets * 1000) : null,
  };
}

/** The status entry the runner sends, read loosely like every other. */
function statusOf(value: unknown): ChatStatus {
  const entry = record(value);
  const context = record(entry?.context_window);
  const limits = record(entry?.rate_limits);
  const usedPercent = percentOf(context?.used_percentage);
  const window = context?.context_window_size;
  return {
    context:
      usedPercent !== null && typeof window === 'number' && window > 0
        ? { usedPercent, window }
        : null,
    fiveHour: limitOf(limits?.five_hour),
    sevenDay: limitOf(limits?.seven_day),
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

function questionsOf(value: unknown): ChatQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    const entry = record(raw);
    const question = text(entry?.question);
    if (!question) return [];
    const options = (Array.isArray(entry?.options) ? entry.options : []).flatMap((rawOption) => {
      const option = record(rawOption);
      const label = text(option?.label);
      return label ? [{ label, description: text(option?.description) }] : [];
    });
    return [
      { header: text(entry?.header), question, multiSelect: entry?.multiSelect === true, options },
    ];
  });
}

/**
 * The answers in an `AskUserQuestion` result: Claude Code words them as
 * `"<question>"="<answer>"` pairs, several picks joined by commas. A
 * question with a quote in it can defeat this; it is then left out.
 */
function answersOf(output: string | null): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const match of (output ?? '').matchAll(/"((?:[^"\\]|\\.)*)"="((?:[^"\\]|\\.)*)"/g)) {
    const [, question, answer] = match;
    if (question !== undefined && answer !== undefined) answers[question] = answer;
  }
  return answers;
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
