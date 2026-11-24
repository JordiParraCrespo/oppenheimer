/**
 * A session's conversation read as a chat:
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

import type { CodingAgentClear } from '@oppenheimer/shared/agents';
import type { ChatCommand } from '@oppenheimer/shared/protocol';
import type { ChatItemTodo } from '@oppenheimer/shared/schemas/chat-item';
import {
  type ChatAnswer,
  PERMISSION_KEY_GAP_MS,
  permissionChoiceKeys,
  QUESTION_KEY_GAP_MS,
  questionKeys,
} from '@oppenheimer/shared/sessions';
import { type ChatToolKind, classifyTool, fieldOf, todosOf } from '../../chat/chat-tools';
import { type ChatActivity, sameActivity } from './agent-activity';
import {
  type ChatFeedbackAction,
  type ChatFeedbackDraft,
  sameFeedbackDraft,
} from './feedback-draft';
import { type ChatPermissionPrompt, samePermissionPrompt } from './permission-prompt';
import {
  type ChatSharedFile,
  type ChatSharedVisual,
  SHARED_ENTRY,
  sharedFileOf,
  sharedVisualOf,
  VISUAL_ENTRY,
  withSharedFiles,
} from './session-chat-files';
import { FirstLoad, linesToCome, Quiet } from './session-chat-history';
import { typedPrompt, withoutReminders } from './session-chat-prompt';
import { type ChatSending, SentMessages } from './session-chat-sending';
import { Subagents } from './session-chat-subagents';

export type { ChatSending } from './session-chat-sending';

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

/** One replacement an edit made: the text it took out, empty for a write, and the text it put in. */
export interface ChatFileEdit {
  before: string;
  after: string;
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
  /**
   * What an edit or a write put in the file, as far as the host sent it: a
   * long text arrives as its head, and `editsTruncated` says so.
   */
  edits: ChatFileEdit[] | null;
  /** The host cut the call's input, so `edits` is not the whole change (`truncated` is also a cut result). */
  editsTruncated: boolean;
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
  /**
   * The subagent the call started, with its own work, once the host has
   * sent it (`session-chat-subagents.ts`); none for any other call, and for
   * one from a host or an agent whose subagents it does not follow.
   */
  subagent: ChatSubagent | null;
}

/**
 * How a subagent stands: at work, finished, failed, or stopped before it
 * finished (a Codex turn aborted).
 */
export type ChatSubagentState = 'running' | 'completed' | 'failed' | 'stopped';

/** A subagent one of the agent's calls started, and what it did. */
export interface ChatSubagent {
  id: string;
  /** Its kind, as the agent names it (`Explore`, `general-purpose`, a Codex role). */
  type: string | null;
  /** The name the agent gave it (Codex's nickname). */
  name: string | null;
  model: string | null;
  state: ChatSubagentState;
  /** Its own steps, in order: what it read, ran and said, its subagents among them. */
  steps: ChatStep[];
  /** What its context held at its last answer, when counted. */
  tokens: number | null;
  /** How many calls it made. */
  calls: number;
  startedAt: Date | null;
  lastAt: Date | null;
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
   * The agent answered on another model than it last did (a `/model`, a plan
   * mode that switches, a fallback): placed before the first step it wrote
   * on the new one. Never for the first model the chat holds.
   */
  | { kind: 'model'; id: string; at: Date | null; model: string }
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
  | { kind: 'file'; id: string; at: Date | null; file: ChatSharedFile }
  /** A visual the agent showed the person (`runner sessions show`), placed by when; checked where it is drawn. */
  | { kind: 'visual'; id: string; at: Date | null; spec: unknown };

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
  /** What went to the agent and is not in its transcript yet, in the order sent. */
  sending: readonly ChatSending[];
  /** The latest status the host sent, if any. */
  status: ChatStatus | null;
  /** The files the agent shared, in the order they came; each also a step of its turn. */
  files: readonly ChatSharedFile[];
  /**
   * Turns before the first one held, on the host: `more` to ask for
   * (`loadOlder`), `loading` while a page of them is on its way, `none`
   * when the whole conversation is held.
   */
  older: 'none' | 'more' | 'loading';
  /**
   * What the agent says it is doing this moment, off its spinner line on the
   * terminal (`setActivity`); none while it is not working, or while no
   * terminal is drawn to read it from.
   */
  activity: ChatActivity | null;
  /**
   * The next message the agent predicts the person will send, off its input
   * box on the terminal (`setSuggestion`, `readPromptSuggestion`), for the
   * composer to offer: Tab takes it. None while the agent shows none, or
   * while no terminal is drawn to read it from.
   */
  suggestion: string | null;
  /**
   * The feedback report the agent drafted, as the card over the terminal's
   * input box shows it (`setFeedback`, `readFeedbackDraft`), for the chat to
   * offer its keys (`pressFeedback`). None while it shows none, or while no
   * terminal is drawn to read it from.
   */
  feedback: ChatFeedbackDraft | null;
  /**
   * The permission dialog the agent draws before a tool runs, as the
   * terminal under the chat shows it (`setPermission`,
   * `readPermissionPrompt`), for the chat to answer (`answerPermission`).
   * None while it draws none, for an agent whose dialog the console does not
   * read, or while no terminal is drawn to read it from.
   */
  permission: ChatPermissionPrompt | null;
  /**
   * Whether what the chat is connected to can stop the agent's turn: a
   * terminal can (Escape), a Claude Code cloud session's hooks cannot
   * (`connect`). While it cannot, the composer offers no Stop, and a message
   * goes at once rather than waiting in the queue for the turn to end: its
   * source keeps it until the agent takes it.
   */
  interruptible: boolean;
  /**
   * The slash commands the session's project gives its agent, from the
   * host's last reset; null until a host says, and from one that predates
   * them, when the composer offers the agent's built-ins alone.
   */
  commands: readonly ChatCommand[] | null;
}

export interface ChatBatch {
  reset?: boolean;
  /** Where the history a reset started stands: `more` is coming, or this batch is its `end`. */
  history?: 'more' | 'end';
  /**
   * Where in the transcript what the host sent starts: on a reset that sent
   * only the last turns, and on an older page's last batch. Absent or 0, the
   * conversation from its first line.
   */
  before?: number;
  /** Part of an older page asked for (`loadOlder`): `more` is coming, or this batch is its `end`. */
  older?: 'more' | 'end';
  entries: readonly string[];
  /** On a reset: the project's slash commands (`ChatState.commands`). */
  commands?: readonly ChatCommand[];
}

const EMPTY: ChatState = {
  available: false,
  loading: false,
  turns: [],
  queued: [],
  sending: [],
  status: null,
  files: [],
  older: 'none',
  activity: null,
  suggestion: null,
  feedback: null,
  permission: null,
  interruptible: true,
  commands: null,
};

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
 * How long a key pressed on the drafted-feedback card holds the next one
 * while the card on screen has not moved: long enough for a double click,
 * short enough that a key the card ignored does not leave it dead.
 */
const FEEDBACK_KEY_HOLD_MS = 1500;
/**
 * How long a note waits after the refusal it goes with, where the dialog
 * takes none of its own: the agent closes the dialog and opens its prompt
 * before it can take the words.
 */
const NOTE_AFTER_REFUSAL_MS = 400;
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
  /**
   * A replay that starts mid-conversation (a tail, `ChatBatch.before`): its
   * first line is looked for among those held, and the replay checked from
   * there; the held lines before it stay.
   */
  private aligning = false;
  /** A tail whose first line was not among those held: the conversation is drawn from the tail. */
  private restarted = false;

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
  reset(replaying: boolean, tail = false): boolean {
    this.restarted = false;
    if (replaying && this.lines.length > 0) {
      this.replayed = 0;
      this.aligning = tail;
      return false;
    }
    this.replayed = null;
    this.aligning = false;
    this.truncate(0);
    return true;
  }

  /** Whether the last tail started the conversation over, and forgets it. */
  takeRestarted(): boolean {
    const restarted = this.restarted;
    this.restarted = false;
    return restarted;
  }

  /**
   * Lines from before the first one held, an older page: the conversation
   * is read again from its new first line, and a replay under way goes on
   * where it was.
   */
  prepend(lines: readonly TranscriptLine[]): boolean {
    if (lines.length === 0) return false;
    // A copy: the cut empties the array it holds in place.
    const held = [...this.lines];
    const replayed = this.replayed;
    this.truncate(0);
    this.lines = [...lines, ...held];
    this.unread = 0;
    if (replayed !== null) this.replayed = replayed + lines.length;
    return true;
  }

  /** A replay that will send nothing more: what is held stays as it is. */
  endReplay(): void {
    this.replayed = null;
    this.aligning = false;
  }

  /** One line of the conversation; whether it changed what is held. */
  take(raw: string, entry: unknown): boolean {
    if (this.aligning) {
      this.aligning = false;
      const at = this.lastIndexOf(raw);
      if (at < 0) {
        this.replayed = null;
        this.restarted = true;
        this.truncate(0);
      } else {
        this.replayed = at;
      }
    }
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
      false,
      lastModel(this.closed),
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
    this.aligning = false;
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

  /** Where a line is held, looked for from the end, where a tail starts; -1 for nowhere. */
  private lastIndexOf(raw: string): number {
    for (let index = this.lines.length - 1; index >= 0; index -= 1) {
      if (this.lines[index]?.raw === raw) return index;
    }
    return -1;
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
  /** When a key last went to the drafted-feedback card whose reading still stands. */
  private feedbackPressedAt: number | null = null;
  private readonly transcript = new Transcript();
  /** The subagents the agent ran, held apart and put into their calls (`turnsOf`). */
  private readonly subagents = new Subagents(sidechainTurns);
  /** A first load's history, held until it has all come (`ChatState.loading`). */
  private readonly firstLoad = new FirstLoad();
  private type: ((data: string) => void) | null = null;
  /** How the agent's prompt is emptied before a message; null for an agent that needs nothing. */
  private clear: CodingAgentClear | null = null;
  /** Asks the host for the turns before an offset, lent with the input (`connect`). */
  private askOlder: ((before: number) => void) | null = null;
  /** Where in the transcript the lines held start: 0 for its first line. */
  private heldFrom = 0;
  /** The lines of an older page still coming, while one is asked for. */
  private olderLines: string[] | null = null;
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
  /** What was typed and is not in the transcript yet (`ChatState.sending`). */
  private readonly sent = new SentMessages((id) =>
    this.publish({ ...this.state, sending: this.state.sending.filter((held) => held.id !== id) }),
  );
  /** The quiet that ends a first load or a replay that came back short. */
  private readonly quiet = new Quiet();
  /** The visuals the agent showed, in the order they came; each a step of its turn. */
  private visuals: readonly ChatSharedVisual[] = [];

  apply(batch: ChatBatch): void {
    if (batch.older) {
      this.takeOlder(batch);
      return;
    }
    // A first load is held back until its history has come, so the chat
    // draws it once, at its end, not each part of a long one in turn.
    this.firstLoad.take(batch, this.transcript.empty);
    const from = batch.before ?? 0;
    let changed = false;
    if (batch.reset) {
      // An older page asked of the attachment before this one never comes.
      this.olderLines = null;
      // A tail is checked against what is held from where it starts, and
      // the turns held before it stay: the held conversation starts at the
      // earlier of the two.
      const held = !this.transcript.empty;
      changed = this.transcript.reset(linesToCome(batch), from > 0);
      // A conversation that starts over takes its subagents with it.
      if (changed) this.subagents.clear();
      this.heldFrom = held && from > 0 ? Math.min(this.heldFrom, from) : from;
    }
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
      } else if (type === VISUAL_ENTRY) {
        // Each attachment sends every visual again, as it does the files; one is held once.
        const visual = sharedVisualOf(entry);
        if (visual && !this.visuals.some((held) => held.id === visual.id)) {
          this.visuals = [...this.visuals, visual];
          changed = true;
        }
      } else {
        const subagent = this.subagents.take(raw, entry);
        if (subagent === null ? this.transcript.take(raw, entry) : subagent) changed = true;
      }
    }
    // A tail that is not where the held conversation goes is a different one.
    if (this.transcript.takeRestarted()) this.heldFrom = from;
    // The history's end, before every line held came again: the transcript
    // is shorter now, without waiting for a quiet to say so.
    if (batch.history === 'end' && this.transcript.settle()) changed = true;
    const commands = batch.reset ? (batch.commands ?? null) : this.state.commands;
    this.publishBatch(changed, status, files, commands);
    this.quiet.watch(this.settleAfter(), this.settled);
    this.flush();
  }

  /**
   * Publishes what a batch changed, once: the turns are built again only
   * when the conversation moved and no first load is holding them back.
   */
  private publishBatch(
    changed: boolean,
    status: ChatStatus | null,
    files: readonly ChatSharedFile[],
    commands: readonly ChatCommand[] | null,
  ): void {
    const was = this.state;
    const redraw =
      !this.loading && (changed || was.loading || !was.available || files !== was.files);
    const older = this.olderState();
    if (
      !redraw &&
      was.available &&
      was.loading === this.loading &&
      was.status === status &&
      was.files === files &&
      was.older === older &&
      was.commands === commands
    ) {
      return;
    }
    this.publish({
      ...was,
      commands,
      available: true,
      loading: this.loading,
      status,
      files,
      older,
      turns: redraw ? this.turnsOf(files) : was.turns,
    });
  }

  private olderState(): ChatState['older'] {
    if (this.olderLines !== null) return 'loading';
    return this.heldFrom > 0 ? 'more' : 'none';
  }

  /**
   * Asks the host for the turns before the first one held, once the reader
   * reaches the top of what is drawn. False when there is nothing older to
   * ask for, a page is already on its way, or nothing is connected to ask.
   */
  loadOlder(): boolean {
    if (!this.askOlder || this.olderLines !== null || this.heldFrom <= 0 || this.loading) {
      return false;
    }
    this.olderLines = [];
    this.askOlder(this.heldFrom);
    this.publish({ ...this.state, older: 'loading' });
    return true;
  }

  /**
   * A batch of the older page asked for: held until its last, then put
   * before the first line held, the conversation read again from there.
   * One that nobody asked for (the attachment that asked is gone) is let go.
   */
  private takeOlder(batch: ChatBatch): void {
    if (this.olderLines === null) return;
    this.olderLines.push(...batch.entries);
    if (batch.older !== 'end') return;
    const lines = this.olderLines.flatMap((raw) => {
      try {
        return [{ raw, entry: JSON.parse(raw) as unknown }];
      } catch {
        return [];
      }
    });
    this.olderLines = null;
    this.heldFrom = batch.before ?? 0;
    const changed = this.transcript.prepend(lines);
    this.publish({
      ...this.state,
      older: this.olderState(),
      turns: changed ? this.turnsOf(this.state.files) : this.state.turns,
    });
  }

  private settleAfter(): number | null {
    return this.firstLoad.settleAfter(this.transcript.replaying);
  }

  /**
   * The history went quiet: a first load is all there, or a replay that
   * stopped short of the lines held says the transcript is shorter now.
   */
  private settled = (): void => {
    const redraw = this.loading || this.transcript.settle();
    this.firstLoad.end();
    if (redraw)
      this.publish({ ...this.state, loading: false, turns: this.turnsOf(this.state.files) });
    this.quiet.watch(this.settleAfter(), this.settled);
    this.flush();
  };

  /** The conversation's turns, with the shared files and visuals placed in them. */
  private turnsOf(files: readonly ChatSharedFile[]): ChatTurn[] {
    return withSharedFiles(this.subagents.place(this.transcript.turns()), files, this.visuals);
  }

  /** A first load is still arriving. */
  private get loading(): boolean {
    return this.firstLoad.loading;
  }

  private publish(state: ChatState): void {
    const sending =
      state.turns !== this.state.turns
        ? this.sent.landed(state.sending, state.turns)
        : state.sending;
    this.state = sending === state.sending ? state : { ...state, sending };
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
    // A source that cannot stop the turn keeps the message itself until the
    // agent takes it, so nothing waits here.
    if (!this.busy() || !this.state.interruptible) {
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

  /**
   * The pane that read this chat is gone, and the stream that fed it with
   * it, while the chat is kept for the session's next pane. What was on its
   * way is not waited for: a replay cut short keeps every line held, rather
   * than taking its quiet for a transcript that got shorter, and a first
   * load cut short is dropped, so the next stream loads it whole. Messages
   * queued for the agent go too: they were written in that visit, and
   * typing them in a later one would drive the agent out of sight.
   */
  detach(): void {
    this.quiet.watch(null, this.settled);
    this.transcript.endReplay();
    this.queuedDuring = null;
    this.sentQueued = null;
    this.olderLines = null;
    this.sent.drop();
    if (this.loading) {
      this.firstLoad.end();
      this.transcript.reset(false);
      this.subagents.clear();
      this.heldFrom = 0;
      this.publish(EMPTY);
      return;
    }
    const older = this.olderState();
    if (
      this.state.queued.length > 0 ||
      this.state.sending.length > 0 ||
      this.state.older !== older
    ) {
      this.publish({ ...this.state, queued: [], sending: [], older });
    }
  }

  /**
   * Lends the chat a way to type into the session's PTY, and to ask its host
   * for older turns; the function returned takes them back. `interruptible:
   * false` says the source cannot stop a turn (`ChatState.interruptible`).
   * `clear` empties the agent's prompt before a message (`clearOf`, ZCode's
   * Ctrl+U).
   */
  connect(
    type: (data: string) => void,
    askOlder?: (before: number) => void,
    { interruptible = true, clear }: { interruptible?: boolean; clear?: CodingAgentClear } = {},
  ): () => void {
    this.type = type;
    this.clear = clear ?? null;
    this.askOlder = askOlder ?? null;
    if (this.state.interruptible !== interruptible) this.publish({ ...this.state, interruptible });
    return () => {
      // Only the connection still lent the chat gives it back; a later one
      // keeps what it said.
      if (this.type !== type) return;
      this.type = null;
      if (askOlder && this.askOlder === askOlder) this.askOlder = null;
      if (!this.state.interruptible) this.publish({ ...this.state, interruptible: true });
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
    const typeMessage = () => {
      if (!empty) type(message.includes('\n') ? `${PASTE_START}${message}${PASTE_END}` : message);
      setTimeout(() => type('\r'), SUBMIT_AFTER_TEXT_MS);
    };
    // A prompt can hold text nobody left there (ZCode recalls its last one on
    // an Up arrow), which the message would be sent joined to: the clear keys
    // go first, and the words once the agent has acted on them, since words
    // in the same burst land in the prompt it has not emptied yet. Not with
    // files: their paths are already in the prompt, pasted for this message.
    if (!empty && !withFiles && this.clear) {
      type(this.clear.keys);
      setTimeout(typeMessage, this.clear.settleMs);
    } else {
      typeMessage();
    }
    // A source that cannot stop the turn says itself what waits with it, and
    // one taken into the turn under way opens no prompt to replace it.
    if (!empty && this.state.interruptible && !this.busy()) this.startSending(message);
  }

  /** Draws a message just typed until its prompt is in the transcript (`SentMessages`). */
  private startSending(text: string): void {
    const sent = this.sent.start(text, this.state.turns.at(-1)?.id ?? null);
    this.publish({ ...this.state, sending: [...this.state.sending, sent] });
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

  /**
   * What the agent's spinner line says now, as the terminal under the chat
   * reads it (`readAgentActivity`); none once it is gone. A reading that
   * says what the last one said publishes nothing.
   */
  setActivity(activity: ChatActivity | null): void {
    if (sameActivity(this.state.activity, activity)) return;
    this.publish({ ...this.state, activity });
  }

  /**
   * The next message the agent suggests now, as the terminal under the chat
   * reads it (`readPromptSuggestion`); none once it is gone. A reading that
   * says what the last one said publishes nothing.
   */
  setSuggestion(suggestion: string | null): void {
    if (this.state.suggestion === suggestion) return;
    this.publish({ ...this.state, suggestion });
  }

  /**
   * The drafted feedback the terminal under the chat shows now
   * (`readFeedbackDraft`); none once it is gone. A reading that says what the
   * last one said publishes nothing.
   */
  setFeedback(feedback: ChatFeedbackDraft | null): void {
    if (sameFeedbackDraft(this.state.feedback, feedback)) return;
    this.feedbackPressedAt = null;
    this.publish({ ...this.state, feedback });
  }

  /**
   * Answers the drafted-feedback card with one of the keys it names, typed
   * as the person would type it in the terminal. False when nothing is
   * connected to type it.
   */
  pressFeedback(action: ChatFeedbackAction): boolean {
    const type = this.type;
    if (!type) return false;
    // The card asks twice on purpose (send, then send without reviewing;
    // dismiss, then turn drafting off): a second press before the screen
    // shows the card's next state would answer a question nobody saw.
    const now = Date.now();
    if (this.feedbackPressedAt !== null && now - this.feedbackPressedAt < FEEDBACK_KEY_HOLD_MS) {
      return false;
    }
    this.feedbackPressedAt = now;
    type(action.key);
    return true;
  }

  /**
   * The permission dialog the terminal under the chat shows now
   * (`readPermissionPrompt`); none once it is gone. A reading that says what
   * the last one said publishes nothing.
   */
  setPermission(permission: ChatPermissionPrompt | null): void {
    if (samePermissionPrompt(this.state.permission, permission)) return;
    this.publish({ ...this.state, permission });
  }

  /**
   * Answers the permission dialog on screen with one of its options, by its
   * index, typed as the person would (`permissionChoiceKeys`), with words of
   * their own where they gave some: in the dialog where it takes them, or
   * else as the next message once the refusal has closed it. False when
   * nothing is connected to type them, or the dialog has moved on since it
   * was shown: an answer is never typed into a dialog nobody saw.
   */
  answerPermission(
    prompt: ChatPermissionPrompt,
    choice: number,
    note: string | null = null,
  ): boolean {
    const type = this.type;
    if (!type || this.state.permission?.id !== prompt.id) return false;
    const keys = permissionChoiceKeys(this.state.permission, choice, note);
    if (keys.length === 0) return false;
    keys.forEach((key, index) => {
      setTimeout(() => type(key), index * PERMISSION_KEY_GAP_MS);
    });
    const words = note?.trim();
    if (words && !this.state.permission.amendKey) {
      setTimeout(
        () => this.send(words),
        keys.length * PERMISSION_KEY_GAP_MS + NOTE_AFTER_REFUSAL_MS,
      );
    }
    return true;
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
      /** The transcript line's own id. */
      id: string;
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

export function classify(value: unknown, index: number, sidechain = false): Reading {
  const entry = record(value);
  const message = record(entry?.message);
  // A subagent's lines are its own conversation, read apart (`session-chat-subagents.ts`).
  if (!entry || !message || (entry.isSidechain === true) !== sidechain) return null;
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
      id,
      steps,
      model: modelOf(message.model),
      at,
      contextTokens: contextOf(message.usage),
    };
  }
  if (entry.type !== 'user') return null;
  if (entry.isCompactSummary === true) {
    return {
      kind: 'steps',
      id,
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
  const said = withoutReminders(
    typeof content === 'string'
      ? content
      : blocks
          .filter((block) => block?.type === 'text')
          .map((block) => String(block?.text ?? ''))
          .join('\n'),
  );
  const system = systemSteps(said, id, at);
  if (system) return { kind: 'steps', id, steps: system, model: null, at };
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
 * A subagent's own lines in turns, read as the session's are: its first
 * prompt is the task it was given.
 */
function sidechainTurns(entries: readonly unknown[]): ChatTurn[] {
  return buildTurns(entries.length, (index) => entries[index], 0, true).turns;
}

/**
 * The turns from entry `from` of `count` on, with the entry each one starts
 * at. `from` is where a turn starts (a prompt), or the first entry.
 */
function buildTurns(
  count: number,
  entryAt: (index: number) => unknown,
  from: number,
  sidechain = false,
  /** The model the agent last answered on before `from`, so a change across a build is still seen. */
  before: string | null = null,
): { turns: ChatTurn[]; starts: number[] } {
  let model = before;
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
    const reading = classify(entryAt(index), index, sidechain);
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
        if (reading.model && model && reading.model !== model) {
          turn.steps.push({
            kind: 'model',
            id: `${reading.id}:model`,
            at: reading.at,
            model: reading.model,
          });
        }
        model = reading.model ?? model;
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
  // A model change says nothing about whether the agent is done.
  const tail = turn.steps.filter((step) => step.kind !== 'model').at(-1);
  if (tail === undefined) return true;
  if (turn.steps.some((step) => step.kind === 'tool' && step.call.status === 'running'))
    return true;
  return tail.kind !== 'reply' && tail.kind !== 'notice' && tail.kind !== 'output';
}

/**
 * The model an answer names, as the agent wrote it; none for Claude Code's
 * `<synthetic>`, the name it gives a line it wrote itself (an API error, a
 * stop), which is no model the agent moved to.
 */
function modelOf(value: unknown): string | null {
  const model = text(value);
  return model && !model.startsWith('<') ? model : null;
}

/** The model the last of these turns answered on, for a build that starts after them. */
function lastModel(turns: readonly ChatTurn[]): string | null {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const model = turns[index]?.model;
    if (model) return model;
  }
  return null;
}

function toolCall(block: Loose): ChatToolCall {
  const name = text(block.name) ?? 'tool';
  const input = record(block.input) ?? {};
  const { kind, label, target, opensPage } = classifyTool(name, input, 'agent');
  const edits = kind === 'edit' || kind === 'write' ? editsOf(name, input) : null;
  return {
    id: text(block.id) ?? name,
    name,
    kind,
    label,
    target,
    opensPage,
    description: fieldOf(input, ['description', 'prompt', 'message']),
    status: 'running',
    output: null,
    diff: edits ? diffOf(edits) : null,
    edits,
    editsTruncated: block.truncated === true,
    todos: kind === 'todo' ? todosOf(input.todos) : null,
    plan: kind === 'plan' ? fieldOf(input, ['plan']) : null,
    questions: kind === 'question' ? questionsOf(input.questions) : null,
    answers: null,
    images: null,
    truncated: block.truncated === true,
    startedAt: null,
    finishedAt: null,
    subagent: null,
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

/** A text's lines; the newline a file ends on closes its last line and starts none. */
const lines = (value: unknown): number =>
  typeof value === 'string' && value.length > 0 ? value.replace(/\n$/, '').split('\n').length : 0;

/**
 * What an edit or a write put in the file, one pair per replacement: the one
 * reading of a tool's old and new text, which the counts and the viewer share.
 */
function editsOf(name: string, input: Loose): ChatFileEdit[] {
  if (name === 'Write') return [{ before: '', after: text(input.content) ?? '' }];
  const edits = Array.isArray(input.edits) ? input.edits.map(record) : [input];
  return edits.map((edit) => ({
    before: text(edit?.old_string) ?? '',
    after: text(edit?.new_string ?? edit?.new_source) ?? '',
  }));
}

function diffOf(edits: readonly ChatFileEdit[]): { additions: number; deletions: number } {
  return edits.reduce(
    (sum, edit) => ({
      additions: sum.additions + lines(edit.after),
      deletions: sum.deletions + lines(edit.before),
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
