import type { CreateSessionDto, SessionState } from '@oppenheimer/shared';

/**
 * The coding agent a session runs, from the closed catalog in
 * `@oppenheimer/shared`. Derived from the create DTO rather than imported from
 * `@oppenheimer/shared/agents`, which the API's classic module resolution cannot
 * reach: the catalog is one union, and this is that union.
 */
export type SessionAgent = CreateSessionDto['agent'];

/**
 * The fold: `(state, event) → state`.
 *
 * `work_session_event` is append-only and is the truth per session; the columns
 * on `work_session` are a **projection** of it, never a second truth
 * (`product/versions/mvp/03-control-plane.md`). Everything here is pure, so a
 * replay of any log rebuilds exactly the row the appends produced — which is the
 * test that the column is genuinely derived rather than separately maintained.
 *
 * The stored lifecycle is the narrowest of the three vocabularies:
 * `starting | open | failed | resolved`. It answers **is this work finished**,
 * not **is a process running** — which is why stopping a session does not change
 * it and why the agent's own observations (`working`, `blocked`, `idle`, `done`,
 * `unknown`) are inputs here and never states.
 */

/**
 * The kinds this fold acts on. The `kind` column is a free-form string on
 * purpose: a runner newer than the control plane may log something this version
 * has never heard of, and the log must keep it. An unknown kind advances
 * `lastEventAt` and nothing else.
 */
export const SESSION_EVENT_KINDS = {
  /** The control plane accepted the request and the session row exists. */
  REQUESTED: 'session.requested',
  /**
   * There is nowhere to send the job yet: the relay is not built, so every host
   * is unreachable and the work is owed rather than lost.
   */
  DISPATCH_PENDING: 'session.dispatch_pending',
  /** The runner has the worktrees, the tmux session and window 0. */
  STARTED: 'session.started',
  /** The launch or the run failed; the person has to look. */
  FAILED: 'session.failed',
  /** The agent and the tmux session ended; every checkout stays on disk. */
  STOPPED: 'session.stopped',
  /**
   * Somebody asked for the session to be restarted. It moves nothing: a request is
   * not an outcome, and the control plane claiming `open` before a host has built
   * anything is the kind of second truth the log exists to prevent. The runner's
   * `session.restarted` is what opens it.
   *
   * Stopping is recorded as the fact it is (`session.stopped`, below) rather than as
   * a request, because the control plane's decision to stop is authoritative: it
   * will not dispatch the session again, so the session is stopped whether or not a
   * host is listening.
   */
  RESTART_REQUESTED: 'session.restart_requested',
  /** Window 0 was recreated in the same worktrees after a stop or a host reboot. */
  RESTARTED: 'session.restarted',
  /** Branches pushed, worktrees removed, the row kept for ever as a tombstone. */
  CLOSED: 'session.closed',
  /** The display name changed — by a person, or by the namer reading the first prompt. */
  NAMED: 'session.named',
  /** A repository was added to a running session. */
  CHECKOUT_ADDED: 'session.checkout_added',
  /** A checkout was retired. The row stays; `removedAt` is what retires it. */
  CHECKOUT_REMOVED: 'session.checkout_removed',
  /** The runner read the first user message out of the agent's own transcript. */
  PROMPT_FIRST: 'prompt.first',
  /** What the screen manifest last observed the agent doing. An input, not a state. */
  AGENT_OBSERVED: 'agent.observed',
  /** A browser opened a terminal on this session. The durable record of an attach. */
  ATTACH_OPENED: 'attach.opened',
} as const;

export type SessionEventKind = (typeof SESSION_EVENT_KINDS)[keyof typeof SESSION_EVENT_KINDS];

/** One entry of the log, as the fold reads it. */
export interface SessionLogEntry {
  seq: number;
  kind: string;
  /** Already parsed from the wire's JSON string. Unknown shapes are ignored, never thrown on. */
  payload: unknown;
  occurredAt: Date;
}

/**
 * Everything the fold produces. Five of these are columns on `work_session`;
 * `name` and `nameSource` are columns too, and the rest of the row (the ids, the
 * agent, the slug) is settled at create and is not folded.
 */
export interface SessionFold {
  state: SessionState;
  /** Bumped on every *change* of state, so a reader can tell a re-fold from a transition. */
  stateSeq: number;
  /** The agent's own session id, as the runner reported it. */
  agentSessionId: string | null;
  lastEventAt: Date | null;
  /** When the agent and the tmux session last ended. Null while it is running. */
  stoppedAt: Date | null;
  /** Null until something names the session; the slug stands in until then. */
  name: string | null;
  /** A model-derived title never overwrites one a person typed. */
  nameSource: SessionNameSource | null;
}

export type SessionNameSource = 'user' | 'model';

export const INITIAL_SESSION_FOLD: SessionFold = {
  state: 'starting',
  stateSeq: 0,
  agentSessionId: null,
  lastEventAt: null,
  stoppedAt: null,
  name: null,
  nameSource: null,
};

/** Reads a string field off a payload of unknown shape, without casting at call sites. */
function stringField(payload: unknown, field: string): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const value = (payload as Record<string, unknown>)[field];
  return typeof value === 'string' && value.trim() ? value : null;
}

/**
 * Apply one event. Pure, total, and order-dependent only through `state` — an
 * event the fold does not recognise still moves `lastEventAt`, because "when did
 * anything last happen here" is true of every entry.
 */
export function foldSessionEvent(fold: SessionFold, event: SessionLogEntry): SessionFold {
  const next: SessionFold = { ...fold, lastEventAt: event.occurredAt };

  switch (event.kind) {
    case SESSION_EVENT_KINDS.REQUESTED:
      return transition(next, 'starting');
    case SESSION_EVENT_KINDS.STARTED:
    case SESSION_EVENT_KINDS.RESTARTED: {
      if (next.state === 'resolved') return next;
      const started = transition(next, 'open');
      started.stoppedAt = null;
      started.agentSessionId =
        stringField(event.payload, 'agentSessionId') ?? started.agentSessionId;
      return started;
    }
    case SESSION_EVENT_KINDS.FAILED:
      return transition(next, 'failed');
    case SESSION_EVENT_KINDS.STOPPED:
      if (next.state === 'resolved') return next;
      // Stopping ends the processes and leaves the worktrees, so the work is
      // exactly as unfinished as it was: the lifecycle does not move, and
      // `stoppedAt` is the whole of what changed.
      next.stoppedAt = event.occurredAt;
      return next;
    case SESSION_EVENT_KINDS.CLOSED: {
      const closed = transition(next, 'resolved');
      closed.stoppedAt = closed.stoppedAt ?? event.occurredAt;
      return closed;
    }
    case SESSION_EVENT_KINDS.NAMED: {
      const name = stringField(event.payload, 'name');
      if (!name) return next;
      const source: SessionNameSource =
        stringField(event.payload, 'source') === 'model' ? 'model' : 'user';
      // A title a model derived from the first prompt never overwrites a name a
      // person typed, whichever order the two arrive in.
      if (source === 'model' && next.nameSource === 'user') return next;
      next.name = name;
      next.nameSource = source;
      return next;
    }
    default:
      return next;
  }
}

/** Replay a whole log. `initial` exists so a fold can resume from a stored row. */
export function foldSessionLog(
  events: readonly SessionLogEntry[],
  initial: SessionFold = INITIAL_SESSION_FOLD,
): SessionFold {
  return events.reduce(foldSessionEvent, initial);
}

/**
 * Move to a state, bumping `stateSeq` only when the state actually changed.
 *
 * `resolved` is terminal. The row is a permanent tombstone — it is what stops a
 * new session inheriting a retired session's directory name and agent
 * conversation state — so a late or replayed `session.started` from a runner that
 * has not heard about the close cannot bring the session back.
 */
function transition(fold: SessionFold, state: SessionState): SessionFold {
  if (fold.state === 'resolved' || fold.state === state) return fold;
  return { ...fold, state, stateSeq: fold.stateSeq + 1 };
}
