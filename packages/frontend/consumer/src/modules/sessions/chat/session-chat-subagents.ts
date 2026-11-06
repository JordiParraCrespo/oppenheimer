/**
 * The subagents a session's agent ran, read beside its transcript: the host
 * follows each subagent's own conversation and sends what it writes as
 * transcript lines marked as the subagent's (`isSidechain`, `agentId`), and
 * one `oppenheimer.subagent` entry per subagent, again whenever it changes,
 * that says what it is and which call started it (`apps/runner`,
 * `follow_subagents.go`). They arrive after the session's history and in no
 * set order, so each is held apart and put into the call that started it
 * when the turns are built.
 *
 * Which call: the one the entry names (Claude Code, OpenCode), or, for a
 * Codex subagent, the `spawn_agent` call whose answer names its thread
 * (`agent_id`) or its task (`task_name`, the last part of its path). A
 * subagent's own subagents hang under its calls the same way.
 */

import type { ChatStep, ChatSubagent, ChatSubagentState, ChatTurn } from './session-chat';
import { sidechainTurns } from './session-chat';

/** The entry the runner adds for what one subagent is. */
const SUBAGENT_ENTRY = 'oppenheimer.subagent';

/** How deep subagents are followed under one another. */
const DEPTH_MAX = 4;

const STATES: ReadonlySet<string> = new Set(['running', 'completed', 'failed', 'stopped']);

type Loose = Record<string, unknown>;

function record(value: unknown): Loose | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Loose)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** What a subagent's entry says of it. */
interface SubagentMeta {
  id: string;
  parentToolUseId: string | null;
  path: string | null;
  type: string | null;
  name: string | null;
  model: string | null;
  state: ChatSubagentState;
  tokens: number | null;
}

function metaOf(entry: Loose): SubagentMeta | null {
  const id = text(entry.id);
  if (!id) return null;
  const state = text(entry.state);
  const tokens = entry.tokens;
  return {
    id,
    parentToolUseId: text(entry.parentToolUseId),
    path: text(entry.path),
    type: text(entry.agentType),
    name: text(entry.name),
    model: text(entry.model),
    state: state && STATES.has(state) ? (state as ChatSubagentState) : 'running',
    tokens: typeof tokens === 'number' && tokens > 0 ? tokens : null,
  };
}

/** One subagent's lines as they came, each held once. */
interface SubagentLines {
  seen: Set<string>;
  entries: unknown[];
}

/** One subagent read into its steps, kept until its lines or its entry change. */
interface Read {
  /** Its own version, which its own lines were read at. */
  version: number;
  turns: ChatTurn[];
  own: ChatStep[];
  /** Its key (`keyOf`): its own version and those of every subagent under it. */
  key: string;
  subagent: ChatSubagent;
}

/**
 * Every subagent the host sent: its entry, its lines, and a version that
 * moves whenever either changes, which is what tells a turn to draw again.
 */
export class Subagents {
  private readonly metas = new Map<string, SubagentMeta>();
  private readonly lines = new Map<string, SubagentLines>();
  private readonly versions = new Map<string, number>();
  private readonly reads = new Map<string, Read>();
  /** The turns already given their subagents, and what they were given. */
  private placed = new WeakMap<ChatTurn, { key: string; turn: ChatTurn }>();

  /** Whether the host has sent any subagent. */
  get empty(): boolean {
    return this.metas.size === 0 && this.lines.size === 0;
  }

  /**
   * Takes an entry if it is a subagent's: its entry or one of its lines.
   * `null` for any other entry; else whether it changed what is held (a
   * reconnect sends every line again, and each is held once).
   */
  take(raw: string, entry: unknown): boolean | null {
    const value = record(entry);
    if (!value) return null;
    if (value.type === SUBAGENT_ENTRY) {
      const meta = metaOf(value);
      if (!meta) return false;
      const held = this.metas.get(meta.id);
      if (held && JSON.stringify(held) === JSON.stringify(meta)) return false;
      this.metas.set(meta.id, meta);
      this.bump(meta.id);
      return true;
    }
    if (value.isSidechain !== true) return null;
    const id = text(value.agentId);
    // A subagent's line from a host that does not say whose: nowhere to put it.
    if (!id) return false;
    let lines = this.lines.get(id);
    if (!lines) {
      lines = { seen: new Set(), entries: [] };
      this.lines.set(id, lines);
    }
    if (lines.seen.has(raw)) return false;
    lines.seen.add(raw);
    lines.entries.push(entry);
    this.bump(id);
    return true;
  }

  /** Forgets every subagent: the conversation starts over. */
  clear(): void {
    this.metas.clear();
    this.lines.clear();
    this.versions.clear();
    this.reads.clear();
    this.placed = new WeakMap();
  }

  /**
   * The turns with each subagent in the call that started it. A turn that
   * holds none, or whose subagents did not change, is the same object as
   * before, so the chat redraws only the turn a subagent moved in.
   */
  place(turns: ChatTurn[]): ChatTurn[] {
    if (this.metas.size === 0) return turns;
    return turns.map((turn) => {
      const steps = this.withSubagents(turn.steps, 0);
      if (steps === turn.steps) return turn;
      const key = this.keyOf(steps);
      const held = this.placed.get(turn);
      if (held && held.key === key) return held.turn;
      const placed = { ...turn, steps };
      this.placed.set(turn, { key, turn: placed });
      return placed;
    });
  }

  private bump(id: string): void {
    this.versions.set(id, (this.versions.get(id) ?? 0) + 1);
  }

  /**
   * The versions of the subagents steps were given and of every subagent
   * under them, which change when any of them does: a subagent's own
   * subagent writing redraws the turn it hangs in.
   */
  private keyOf(steps: readonly ChatStep[]): string {
    const ids: string[] = [];
    for (const step of steps) {
      const subagent = step.kind === 'tool' ? step.call.subagent : null;
      if (subagent) {
        ids.push(
          `${subagent.id}@${this.versions.get(subagent.id) ?? 0}(${this.keyOf(subagent.steps)})`,
        );
      }
    }
    return ids.join(',');
  }

  /** The steps with a subagent in each call that started one; the same array when none did. */
  private withSubagents(steps: ChatStep[], depth: number): ChatStep[] {
    if (depth >= DEPTH_MAX) return steps;
    let out: ChatStep[] | null = null;
    for (const [index, step] of steps.entries()) {
      if (step.kind !== 'tool' || step.call.kind !== 'agent') continue;
      const id = this.subagentOf(step.call.id, step.call.output);
      if (!id) continue;
      const subagent = this.read(id, depth);
      if (!subagent) continue;
      out ??= [...steps];
      out[index] = { ...step, call: { ...step.call, subagent } };
    }
    return out ?? steps;
  }

  /**
   * The subagent a call started: the one whose entry names the call, else
   * the Codex subagent its answer names, by thread or by task.
   */
  private subagentOf(callId: string, output: string | null): string | null {
    for (const meta of this.metas.values()) {
      if (meta.parentToolUseId === callId) return meta.id;
    }
    const answer = answerOf(output);
    if (!answer) return null;
    for (const meta of this.metas.values()) {
      if (meta.parentToolUseId) continue;
      if (answer.agentId === meta.id) return meta.id;
      if (answer.taskName && meta.path?.split('/').at(-1) === answer.taskName) return meta.id;
    }
    return null;
  }

  /** A subagent read into its steps, kept while neither its lines nor its entry change. */
  private read(id: string, depth: number): ChatSubagent | null {
    const meta = this.metas.get(id);
    if (!meta) return null;
    const version = this.versions.get(id) ?? 0;
    let held = this.reads.get(id);
    let turns = held?.turns;
    let own = held?.own;
    if (!held || held.version !== version || !turns || !own) {
      turns = sidechainTurns(this.lines.get(id)?.entries ?? []);
      own = turns.flatMap((turn) => turn.steps);
      held = undefined;
    }
    // Its subagents are put in afresh each time: they move on their own.
    const steps = this.withSubagents(own, depth + 1);
    const key = `${version}(${this.keyOf(steps)})`;
    if (held && held.key === key) return held.subagent;
    const last = turns.at(-1);
    const subagent: ChatSubagent = {
      id,
      type: meta.type,
      name: meta.name,
      model: meta.model ?? lastOf(turns, (turn) => turn.model),
      state: meta.state,
      steps,
      tokens: meta.tokens ?? lastOf(turns, (turn) => turn.contextTokens),
      calls: own.filter((step) => step.kind === 'tool').length,
      startedAt: turns[0]?.startedAt ?? null,
      lastAt: last?.lastAt ?? null,
    };
    this.reads.set(id, { version, turns, own, key, subagent });
    return subagent;
  }
}

/** The last turn's value that is not none. */
function lastOf<T>(turns: readonly ChatTurn[], value: (turn: ChatTurn) => T | null): T | null {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    const found = turn ? value(turn) : null;
    if (found !== null) return found;
  }
  return null;
}

/** What a Codex `spawn_agent` answered: the new thread, or the task's name. */
function answerOf(
  output: string | null,
): { agentId: string | null; taskName: string | null } | null {
  if (!output?.trimStart().startsWith('{')) return null;
  try {
    const answer = record(JSON.parse(output));
    if (!answer) return null;
    return { agentId: text(answer.agent_id), taskName: text(answer.task_name) };
  } catch {
    return null;
  }
}
