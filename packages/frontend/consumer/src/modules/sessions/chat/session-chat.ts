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

import { CHAT_BATCH_MAX_ENTRIES, CHAT_ENTRY_MAX_BYTES } from '@oppenheimer/shared/protocol';
import type { ChatItemTodo } from '@oppenheimer/shared/schemas/chat-item';
import { type ChatAnswer, QUESTION_KEY_GAP_MS, questionKeys } from '@oppenheimer/shared/sessions';
import { type ChatToolKind, classifyTool, fieldOf, todosOf } from '../../chat/chat-tools';
import {
  type ChatSharedFile,
  SHARED_ENTRY,
  sharedFileOf,
  withSharedFiles,
} from './session-chat-files';

/** One item of the agent's task list: the chat module's, which the bots chat reads too. */
export type ChatTodo = ChatItemTodo;
export type ChatTodoStatus = ChatItemTodo['status'];

/** One question `AskUserQuestion` puts to the person, as the agent wrote it. */
export interface ChatQuestion {
  /** The chip over it in the terminal ("Scope"). */
  header: string | null;
  question: string;
  /** Several options may be picked. */
  multiSelect: boolean;
  options: { label: string; description: string | null }[];
}

/**
 * An image in the conversation, pasted with a prompt or in a tool's result
 * (a screenshot the agent read): the preview the host sent, as a URL an
 * `img` takes, or none when the host only named it (no room on the link, a
 * format it cannot read, a host from before previews).
 */
export interface ChatTranscriptImage {
  src: string | null;
}

export interface ChatToolCall {
  id: string;
  /** The tool's own name (`Bash`, `Edit`, `mcp__github__get_issue`). */
  name: string;
  kind: ChatToolKind;
  /** The tool in words, for a call the chat has no verb for (`github · get_issue`). */
  label: string;
  /** What it acted on, in a line: a path, a command, a pattern, a URL. */
  target: string | null;
  /** A web call that opens a page by its URL rather than searching for words. */
  opensPage: boolean;
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
  /** The images its result carried, in order; none for a result of text alone. */
  images: ChatTranscriptImage[] | null;
  /** The host cut the call's input or its output to keep the entry small. */
  truncated: boolean;
  /** When the agent made the call, and when its result landed (none while it runs). */
  startedAt: Date | null;
  finishedAt: Date | null;
}

/**
 * How a background task the agent started ended, as Claude Code reports it;
 * `unknown` for a status this does not know, never taken for a success.
 */
export type ChatTaskStatus = 'completed' | 'failed' | 'killed' | 'unknown';

/** `at` is when the agent wrote the step, from its transcript line. */
export type ChatStep =
  | { kind: 'reply'; id: string; at: Date | null; text: string; truncated: boolean }
  | { kind: 'thinking'; id: string; at: Date | null; text: string }
  | { kind: 'tool'; id: string; at: Date | null; call: ChatToolCall }
  | { kind: 'notice'; id: string; at: Date | null; notice: 'interrupted' | 'compacted' }
  /**
   * What a command the CLI answers itself printed (`/context`, `/cost`), as
   * text with the terminal's colours taken out; `failed` when it wrote to
   * stderr.
   */
  | {
      kind: 'output';
      id: string;
      at: Date | null;
      text: string;
      failed: boolean;
    }
  /** A background task finished: the line Claude Code hands the agent, not a prompt. */
  | { kind: 'task'; id: string; at: Date | null; status: ChatTaskStatus; summary: string | null }
  /** A file the agent showed the person (`runner sessions send-file`), placed by when. */
  | { kind: 'file'; id: string; at: Date | null; file: ChatSharedFile };

export interface ChatPrompt {
  id: string;
  text: string;
  /** Images and documents pasted with it. */
  files: number;
  /** The images among them, each with the host's preview when it sent one. */
  images: ChatTranscriptImage[];
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
  /**
   * The conversation's history is still arriving on a first load: `turns`
   * stays empty until it has, so the chat draws it once, at its end, rather
   * than every part of it as each lands.
   */
  loading: boolean;
  turns: ChatTurn[];
  /** What waits to be sent, in order; the first goes once the agent settles. */
  queued: readonly ChatQueued[];
  /** The latest status the host sent, if any. */
  status: ChatStatus | null;
  /** The files the agent shared, in the order they came; each also a step of its turn. */
  files: readonly ChatSharedFile[];
}

export interface ChatBatch {
  reset?: boolean;
  entries: readonly string[];
}

const EMPTY: ChatState = {
  available: false,
  loading: false,
  turns: [],
  queued: [],
  status: null,
  files: [],
};

/** The entry the runner adds for the status line's figures. */
const STATUS_ENTRY = 'oppenheimer.status';

/** Several lines go to the agent as one bracketed paste, so a newline in them is not Enter. */
const PASTE_START = '\u001b[200~';
const PASTE_END = '\u001b[201~';
/** The key that stops Claude Code's turn. */
const ESCAPE = '\u001b';
/**
 * How long a reconnect's replay may go quiet, short of the lines the chat
 * holds, before those it did not send again are taken as gone: well past
 * the runner's 300ms between reads of a long history.
 */
const REPLAY_SETTLE_MS = 3000;
/**
 * How long a first load's history may go quiet before it is taken as all
 * there: past the runner's 300ms between reads of a long transcript.
 */
const LOAD_SETTLE_MS = 500;

/**
 * Whether a batch is the last of a read of the transcript: the runner fills
 * a batch to `CHAT_BATCH_MAX_ENTRIES` entries or about 128KB, so one under
 * both, by entries and by a full entry's size, is all that read had.
 */
function endsARead(batch: ChatBatch): boolean {
  if (batch.entries.length >= CHAT_BATCH_MAX_ENTRIES) return false;
  let bytes = 0;
  for (const entry of batch.entries) bytes += entry.length;
  return bytes < CHAT_ENTRY_MAX_BYTES;
}
/** How long the agent's prompt takes the text before Enter submits it. */
const SUBMIT_AFTER_TEXT_MS = 60;
/**
 * How long a queued message that went waits for its turn to show before
 * the next may go: a message that opens no turn (a slash command the CLI
 * answers itself) must not hold the rest of the queue.
 */
const QUEUE_SETTLE_MS = 5000;

/** One line of the transcript: as the host sent it, and read. */
interface TranscriptLine {
  raw: string;
  entry: unknown;
}

/**
 * The conversation read so far and the turns it makes. The turns a later
 * prompt has closed are built once and kept by identity: a build makes
 * only the open turn again, so a long conversation costs each line the
 * length of its last turn, not of the whole transcript. A result that lands
 * on a closed turn's call (a background command that finished after the
 * next prompt), or a replay that differs, opens the turns from there again.
 */
class Transcript {
  private lines: TranscriptLine[] = [];
  /** The first line no build has read yet. */
  private unread = 0;
  private closed: ChatTurn[] = [];
  /** The line each closed turn starts at, to build again from one of them. */
  private closedStarts: number[] = [];
  /** The calls in the closed turns and the turn each is in, to notice a result that lands on one. */
  private closedCalls = new Map<string, number>();
  /** The line the open turn starts at. */
  private openFrom = 0;
  /**
   * While a reconnect replays the history: how many of the lines already
   * read it has sent again. A transcript mostly grows, so a replay is what
   * is held followed by what is new; what is held stays, and a line that
   * differs cuts the conversation there. One the CLI shortened ends before
   * it has sent everything held, which `settle` cuts.
   */
  private replayed: number | null = null;

  /** A replay has not yet sent again every line held. */
  /** Nothing of the conversation is held yet. */
  get empty(): boolean {
    return this.lines.length === 0;
  }

  get replaying(): boolean {
    return this.replayed !== null;
  }

  /**
   * A reset: the history again from its first line. With lines to come it
   * is a replay, checked against what is held; with none, the transcript
   * is empty now. Whether that changed the conversation.
   */
  reset(replaying: boolean): boolean {
    if (replaying && this.lines.length > 0) {
      this.replayed = 0;
      return false;
    }
    this.replayed = null;
    this.truncate(0);
    return true;
  }

  /** One line of the conversation; whether it changed what is held. */
  take(raw: string, entry: unknown): boolean {
    if (this.replayed !== null) {
      if (this.lines[this.replayed]?.raw === raw) {
        this.replayed += 1;
        if (this.replayed === this.lines.length) this.replayed = null;
        return false;
      }
      this.truncate(this.replayed);
      this.replayed = null;
    }
    this.lines.push({ raw, entry });
    return true;
  }

  /** The turns: the closed ones as they were, the rest built from the lines. */
  turns(): ChatTurn[] {
    let answered = Number.POSITIVE_INFINITY;
    for (let index = this.unread; index < this.lines.length; index += 1) {
      answered = Math.min(answered, this.closedAnswered(this.lines[index]?.entry, index));
    }
    this.unread = this.lines.length;
    if (answered < this.closed.length) this.reopen(answered);
    const { turns, starts } = buildTurns(
      this.lines.length,
      (index) => this.lines[index]?.entry,
      this.openFrom,
    );
    const open = turns.length - 1;
    for (const [index, turn] of turns.slice(0, Math.max(0, open)).entries()) {
      const at = this.closed.length;
      this.closed.push(turn);
      this.closedStarts.push(starts[index] ?? this.openFrom);
      for (const step of turn.steps)
        if (step.kind === 'tool') this.closedCalls.set(step.call.id, at);
    }
    if (open > 0) this.openFrom = starts[open] ?? this.openFrom;
    const last = turns[open];
    return last ? [...this.closed, last] : [...this.closed];
  }

  /**
   * Ends a replay that went quiet before it sent every line held: the
   * transcript is shorter now, so the lines it did not send again go.
   * Whether any did.
   */
  settle(): boolean {
    if (this.replayed === null) return false;
    const length = this.replayed;
    this.replayed = null;
    this.truncate(length);
    return true;
  }

  /**
   * Keeps the first `length` lines, and opens again every closed turn that
   * held one past them or took a result from one.
   */
  private truncate(length: number): void {
    let turn = length === 0 ? 0 : Number.POSITIVE_INFINITY;
    // A result past the cut that landed on a closed turn's call goes with it.
    for (let index = length; index < this.lines.length && turn > 0; index += 1) {
      turn = Math.min(turn, this.closedAnswered(this.lines[index]?.entry, index));
    }
    this.lines.length = Math.min(this.lines.length, length);
    this.unread = Math.min(this.unread, length);
    if (length < this.openFrom) {
      // The first closed turn that runs past `length`: it ends where the next starts.
      let first = 0;
      while ((this.closedStarts[first + 1] ?? this.openFrom) <= length) first += 1;
      turn = Math.min(turn, first);
    }
    if (turn >= this.closed.length) return;
    this.reopen(turn);
    if (turn === 0) this.openFrom = 0;
  }

  /** Opens the closed turns from `turn` on again, for the next build to make afresh. */
  private reopen(turn: number): void {
    this.openFrom = this.closedStarts[turn] ?? 0;
    this.closed = this.closed.slice(0, turn);
    this.closedStarts = this.closedStarts.slice(0, turn);
    for (const [call, at] of this.closedCalls) if (at >= turn) this.closedCalls.delete(call);
  }

  /** The earliest closed turn a result in this entry lands on; `Infinity` for none. */
  private closedAnswered(entry: unknown, index: number): number {
    if (this.closedCalls.size === 0) return Number.POSITIVE_INFINITY;
    const reading = classify(entry, index);
    if (reading?.kind !== 'results') return Number.POSITIVE_INFINITY;
    return Math.min(
      ...reading.results.map(
        (result) => this.closedCalls.get(result.toolUseId) ?? Number.POSITIVE_INFINITY,
      ),
    );
  }
}

/**
 * One attachment's chat: batches in, an immutable `ChatState` out, with a
 * subscription a React store can read (`useSyncExternalStore`), and the way
 * back to the agent, which is its terminal. A reconnect's new attachment
 * sends the history again under a reset, which leaves what is drawn alone
 * where it matches (`Transcript.reset`). Whoever holds the stream
 * feeds it (`apply`) and lends it the stream's input (`connect`); the view
 * reads it and types through it without knowing there is a stream.
 */
export class SessionChat {
  private readonly transcript = new Transcript();
  /** A first load's history is still arriving (`ChatState.loading`). */
  private loading = false;
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
  private replayTimer: ReturnType<typeof setTimeout> | null = null;
  private loadTimer: ReturnType<typeof setTimeout> | null = null;

  apply(batch: ChatBatch): void {
    // A first load: a history arriving where none is held yet. It is held
    // back until it has all come, so the chat does not draw each part of a
    // long one in turn, its window running through the conversation.
    if (batch.reset && batch.entries.length > 0 && this.transcript.empty) this.loading = true;
    if (this.loading && endsARead(batch)) {
      this.loading = false;
      if (this.loadTimer) clearTimeout(this.loadTimer);
      this.loadTimer = null;
    }
    let changed = batch.reset ? this.transcript.reset(batch.entries.length > 0) : false;
    let status = this.state.status;
    let files = this.state.files;
    for (const raw of batch.entries) {
      let entry: unknown;
      try {
        entry = JSON.parse(raw);
      } catch {
        // A line the host sent that is not JSON is the host's bug; skip it.
        continue;
      }
      const type = record(entry)?.type;
      // The status is the latest one, not a line of the conversation.
      if (type === STATUS_ENTRY) status = statusOf(entry);
      else if (type === SHARED_ENTRY) {
        // Each attachment sends every shared file again; one is held once.
        const file = sharedFileOf(entry);
        if (file && !files.some((held) => held.id === file.id)) files = [...files, file];
      } else if (this.transcript.take(raw, entry)) changed = true;
    }
    if (this.loading) {
      if (!this.state.loading || status !== this.state.status || files !== this.state.files) {
        this.publish({ ...this.state, available: true, loading: true, status, files });
      }
      this.watchLoad();
      return;
    }
    if (changed || !this.state.available || this.state.loading || files !== this.state.files) {
      this.publish({
        ...this.state,
        available: true,
        loading: false,
        turns: this.turnsOf(files),
        status,
        files,
      });
    } else if (status !== this.state.status) {
      // A replay so far, or a status alone: the conversation is as drawn.
      this.publish({ ...this.state, status });
    }
    this.watchReplay();
    this.flush();
  }

  /** Ends a first load that went quiet: what has come is the history. */
  private watchLoad(): void {
    if (this.loadTimer) clearTimeout(this.loadTimer);
    this.loadTimer = setTimeout(() => {
      this.loadTimer = null;
      this.loading = false;
      this.publish({ ...this.state, loading: false, turns: this.turnsOf(this.state.files) });
      this.flush();
    }, LOAD_SETTLE_MS);
  }

  /**
   * A replay that stops short of the lines held says the transcript is
   * shorter now; nothing marks a history's end, so its quiet does.
   */
  private watchReplay(): void {
    if (this.replayTimer) clearTimeout(this.replayTimer);
    this.replayTimer = null;
    if (!this.transcript.replaying) return;
    this.replayTimer = setTimeout(() => {
      this.replayTimer = null;
      if (!this.transcript.settle()) return;
      this.publish({ ...this.state, turns: this.turnsOf(this.state.files) });
      this.flush();
    }, REPLAY_SETTLE_MS);
  }

  /** The conversation's turns, with the shared files placed in them. */
  private turnsOf(files: readonly ChatSharedFile[]): ChatTurn[] {
    return withSharedFiles(this.transcript.turns(), files);
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
  /**
   * A command the CLI answered itself (`/cost`): its output ends the turn it
   * opened, and is a step of it when it printed something.
   */
  | { kind: 'answered'; at: Date | null; output: ChatStep | null }
  | null;

interface ChatResult {
  toolUseId: string;
  failed: boolean;
  output: string | null;
  images: ChatTranscriptImage[] | null;
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
            images: Array.isArray(block.images)
              ? block.images.map((image) => imageOf(record(image)))
              : null,
            truncated: block.truncated === true,
          },
        ]
      : [],
  );
  if (results.length > 0) return { kind: 'results', results, at };
  if (entry.isMeta === true) return null;
  if (typeof content === 'string' && LOCAL_COMMAND.test(content)) {
    return { kind: 'answered', at, output: localOutput(content, id, at) };
  }
  const said =
    typeof content === 'string'
      ? content
      : blocks
          .filter((block) => block?.type === 'text')
          .map((block) => String(block?.text ?? ''))
          .join('\n');
  const system = systemSteps(said, id, at);
  if (system) return { kind: 'steps', steps: system, model: null, at };
  const typed = typedPrompt(said);
  if (typed === null) return null;
  const files = blocks.filter(
    (block) => block?.type === 'image' || block?.type === 'document',
  ).length;
  const images = blocks.flatMap((block) => (block?.type === 'image' ? [imageOf(block)] : []));
  return { kind: 'prompt', prompt: { id, text: typed, files, images, at } };
}

const LOCAL_COMMAND = /^\s*<local-command-std(?:out|err)>/;
const LOCAL_OUTPUT =
  /<local-command-std(out|err)>([\s\S]*?)(?:<\/local-command-std(?:out|err)>|$)/g;
/** A control sequence (a colour, a cursor move) or an OSC string (a link, a title). */
const ANSI =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: the escapes are what it removes
  /\u001b\[[0-?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)|\u001b[@-Z\\-_]/g;

/** A command's output as the terminal printed it, with its escapes and carriage returns removed. */
function plainOutput(raw: string): string {
  return raw
    .replace(ANSI, '')
    .replace(/\r(?!\n)/g, '')
    .replace(/\r\n/g, '\n');
}

/**
 * The step a `<local-command-stdout>` line stands for: what the command
 * printed, or none when it printed nothing (`/clear`, a setting changed in a
 * picker). The host may have cut the line, losing its closing tag.
 */
function localOutput(content: string, id: string, at: Date | null): ChatStep | null {
  let failed = false;
  const parts: string[] = [];
  for (const [, stream, body = ''] of content.matchAll(LOCAL_OUTPUT)) {
    if (stream === 'err') failed = true;
    parts.push(body);
  }
  const output = plainOutput(parts.join('\n')).replace(/^\n+|\s+$/g, '');
  if (output.trim() === '') return null;
  return { kind: 'output', id, at, text: output, failed };
}

/** The media types an image's preview may come as: what an `img` shows and never runs. */
const IMAGE_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

/**
 * An image block's preview, as a `data:` URL, read off Claude's own shape
 * (`source: { type: 'base64', media_type, data }`); none for a block the
 * host only named, or whose source is not base64 of a known image type.
 */
function imageOf(block: Loose | null): ChatTranscriptImage {
  const source = record(block?.source);
  const type = text(source?.media_type);
  const data = text(source?.data);
  if (source?.type !== 'base64' || !type || !IMAGE_TYPES.has(type) || !data) return { src: null };
  if (!/^[A-Za-z0-9+/]+=*$/.test(data)) return { src: null };
  return { src: `data:${type};base64,${data}` };
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

const TASK_NOTIFICATION = /<task-notification>([\s\S]*?)<\/task-notification>/g;
const TASK_STATUS = /<status>([\s\S]*?)<\/status>/;
const TASK_SUMMARY = /<summary>([\s\S]*?)<\/summary>/;
const TASK_STATUSES: ReadonlySet<string> = new Set(['completed', 'failed', 'killed']);

/**
 * The steps a user line stands for when the CLI wrote it and nobody typed
 * it, or `null` for every other line. The note Claude Code writes when the
 * person stops a turn is a notice. The `<task-notification>` blocks it
 * writes when a background command or subagent ends, so the agent picks the
 * result up, are a step each, read off their `<status>` and `<summary>`.
 */
function systemSteps(raw: string, id: string, at: Date | null): ChatStep[] | null {
  const value = raw.trimStart();
  if (value.startsWith('[Request interrupted')) {
    return [{ kind: 'notice', id, at, notice: 'interrupted' }];
  }
  if (!value.startsWith('<task-notification>')) return null;
  return [...value.matchAll(TASK_NOTIFICATION)].map(([, body = ''], position) => {
    const status = TASK_STATUS.exec(body)?.[1]?.trim() ?? '';
    return {
      kind: 'task',
      id: `${id}:${position}`,
      at,
      status: TASK_STATUSES.has(status) ? (status as ChatTaskStatus) : 'unknown',
      summary: TASK_SUMMARY.exec(body)?.[1]?.trim() || null,
    };
  });
}

/** The entries in turns: a turn opens at each prompt the person typed. */
export function toTurns(entries: readonly unknown[]): ChatTurn[] {
  return buildTurns(entries.length, (index) => entries[index], 0).turns;
}

/**
 * The turns from entry `from` of `count` on, with the entry each one starts
 * at. `from` is where a turn starts (a prompt), or the first entry.
 */
function buildTurns(
  count: number,
  entryAt: (index: number) => unknown,
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

  for (let index = from; index < count; index += 1) {
    const reading = classify(entryAt(index), index);
    if (!reading) continue;
    switch (reading.kind) {
      case 'prompt':
        starts.push(index);
        open(turns, reading.prompt, reading.prompt.id, reading.prompt.at);
        continue;
      case 'steps': {
        const turn = current(reading.steps[0]?.id ?? `entry-${index}`, reading.at, index);
        // The agent at work again (a background task's end woke it) after a
        // command the CLI answered: the turn is no longer settled by that answer.
        if (reading.steps.length > 0) answered.delete(turn);
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
          if (reading.output) turn.steps.push(reading.output);
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
          call.images = result.images;
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
  return tail.kind !== 'reply' && tail.kind !== 'notice' && tail.kind !== 'output';
}

/**
 * The person's words as they typed them, or `null` for a line that is the
 * CLI's own (a caveat, a command's output). A slash command is written as
 * tags; it reads as `/name arguments`.
 */
function typedPrompt(raw: string): string | null {
  const value = raw.trim();
  if (value === '') return null;
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

function toolCall(block: Loose): ChatToolCall {
  const name = text(block.name) ?? 'tool';
  const input = record(block.input) ?? {};
  const { kind, label, target, opensPage } = classifyTool(name, input, 'agent');
  return {
    id: text(block.id) ?? name,
    name,
    kind,
    label,
    target,
    opensPage,
    description: fieldOf(input, ['description', 'prompt']),
    status: 'running',
    output: null,
    diff: kind === 'edit' || kind === 'write' ? diffOf(name, input) : null,
    todos: kind === 'todo' ? todosOf(input.todos) : null,
    plan: kind === 'plan' ? fieldOf(input, ['plan']) : null,
    questions: kind === 'question' ? questionsOf(input.questions) : null,
    answers: null,
    images: null,
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
