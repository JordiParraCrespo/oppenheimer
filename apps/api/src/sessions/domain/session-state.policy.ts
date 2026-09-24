import type {
  CreateSessionDto,
  SessionEffortDto,
  SessionPermissionDto,
  SessionState,
} from '@oppenheimer/shared';
import { SESSION_EFFORTS, SESSION_PERMISSIONS } from '@oppenheimer/shared';
import { CODING_AGENTS, isCodingAgentId } from '@oppenheimer/shared/agents';

/**
 * The fold: `(fold, event) → fold`.
 *
 * `work_session_event` is append-only and is the truth per session; the columns
 * on `work_session` are a **projection** of it, never a second truth
 * (`product/versions/mvp/03-control-plane.md`). Everything here is pure, so a
 * replay of any log rebuilds exactly the row the appends produced — which is the
 * test that the columns are genuinely derived rather than separately maintained.
 *
 * Every input the console needs is folded here, including the ones that are not
 * the lifecycle: what the agent was last observed doing, when it entered that
 * state, the report hashes behind "finished and you have not looked", and which
 * checkout the agent was launched in. They are columns for one reason — the read
 * path must not walk a log to answer a list — and they are folded for another:
 * anything written outside `recordEvent` would be a second truth a replay
 * disagrees with.
 */

/**
 * The coding agent a session runs, from the closed catalog in
 * `@oppenheimer/shared`. Derived from the create DTO rather than imported from
 * `@oppenheimer/shared/agents`, which the API's classic module resolution cannot
 * reach: the catalog is one union, and this is that union.
 */
export type SessionAgent = CreateSessionDto['agent'];

/**
 * What the screen manifest reports. An **input** to the derived group, never a
 * session state: mapping `done` and `unknown` onto `SessionState` was the error
 * an earlier draft made. `done` folds in with `idle` as "ready for a prompt";
 * `unknown` counts as not-ready and is what makes a launch look stuck.
 */
export const AGENT_OBSERVED_STATES = ['working', 'blocked', 'idle', 'done', 'unknown'] as const;

export type AgentObservedState = (typeof AGENT_OBSERVED_STATES)[number];

/**
 * The kinds this fold acts on. The `kind` column is a free-form string on
 * purpose: a runner newer than the control plane may log something this version
 * has never heard of, and the log must keep it. An unknown kind advances
 * `lastEventAt` and nothing else.
 *
 * Every kind here has a writer. A vocabulary entry nothing writes is how the
 * fold and the routes drift, so `attach.opened` and `session.dispatch_pending`
 * are deliberately absent: the first belongs to whoever claims the ticket and
 * the second to a dispatcher that can actually fail to send, and neither exists
 * yet.
 */
export const SESSION_EVENT_KINDS = {
  /** The control plane accepted the request and the session row exists. */
  REQUESTED: 'session.requested',
  /** Where the agent is launched. Payload `{ checkoutId }`, null for the session root. */
  CWD_SET: 'session.cwd_set',
  /** The runner has the worktrees, the tmux session and window 0. */
  STARTED: 'session.started',
  /** The launch or the run failed; the person has to look. */
  FAILED: 'session.failed',
  /** The agent and the tmux session ended; every checkout stays on disk. */
  STOPPED: 'session.stopped',
  /**
   * Somebody asked for the session to be restarted. It moves nothing: a request is
   * not an outcome, and the control plane claiming `open` before a host has built
   * anything is the second truth the log exists to prevent.
   *
   * Stopping is recorded as the fact it is, because the control plane's decision to
   * stop is authoritative — it will not dispatch the session again, so the session
   * is stopped whether or not a host is listening. Closing is a request for the
   * opposite reason: it has to push branches and remove worktrees, and it refuses
   * on work that is not home, so only the host can say it happened.
   */
  RESTART_REQUESTED: 'session.restart_requested',
  /** Window 0 was recreated in the same worktrees after a stop or a host reboot. */
  RESTARTED: 'session.restarted',
  /** Somebody asked to close. Payload `{ acceptUnpushedWork }`, which the runner reads. */
  CLOSE_REQUESTED: 'session.close_requested',
  /** Branches pushed, worktrees removed. The row is kept for ever as a tombstone. */
  CLOSED: 'session.closed',
  /** The display name changed — by a person, or by the namer reading the first prompt. */
  NAMED: 'session.named',
  /** A repository was added to a session. */
  CHECKOUT_ADDED: 'session.checkout_added',
  /** A checkout was retired. Payload `{ checkoutId }`. The row stays; `removedAt` retires it. */
  CHECKOUT_REMOVED: 'session.checkout_removed',
  /** The runner read the first user message out of the agent's own transcript. */
  PROMPT_FIRST: 'prompt.first',
  /** What the screen manifest last observed the agent doing. Payload `{ state }`. */
  AGENT_OBSERVED: 'agent.observed',
  /** The agent left a report. Payload `{ hash }` — never the report itself. */
  REPORT_PUBLISHED: 'report.published',
  /** Somebody read that report. Payload `{ hash }`. */
  REPORT_ACKNOWLEDGED: 'report.acknowledged',
} as const;

export type SessionEventKind = (typeof SESSION_EVENT_KINDS)[keyof typeof SESSION_EVENT_KINDS];

/**
 * How the agent was started, as the fold keeps it.
 *
 * A projection like every other column here, and a column for the same reason
 * they are: a restart has to relaunch the session the way it was launched, and
 * the console shows the engine button on a session that already exists. Neither
 * can walk a log (`product/versions/mvp/03-control-plane.md`).
 *
 * `permission` is null exactly when the agent has no approvals (the blank
 * terminal). Every other session was launched at some level, and `ask` is what
 * an absent choice meant — see `launchPermissionFor`.
 */
export interface SessionLaunchFold {
  model: string | null;
  permission: SessionPermissionDto | null;
  effort: SessionEffortDto | null;
}

/** One entry of the log, as the fold reads it. */
export interface SessionLogEntry {
  seq: number;
  kind: string;
  /** Already parsed from the wire's JSON string. Unknown shapes are ignored, never thrown on. */
  payload: unknown;
  occurredAt: Date;
}

/**
 * Who chose the name: a person, a model reading the first prompt, or the first
 * prompt's own words when no model answered in time.
 */
export type SessionNameSource = 'user' | 'model' | 'prompt';

/**
 * Everything the fold produces, and every one of these is a column on
 * `work_session`. That is the whole point: `group(now)` has to be a function of
 * the row, so a listing never walks a log.
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
  /** A derived title (`model` or `prompt`) never overwrites one a person typed. */
  nameSource: SessionNameSource | null;
  /** Which checkout the agent was launched in. Null is the session directory itself. */
  cwdCheckoutId: string | null;
  /** What the agent was last observed doing. Null until a runner says. */
  lastObservedState: AgentObservedState | null;
  /**
   * When the **transition into** that state was recorded, or null when the log has
   * only ever seen it once — which is what makes the group's debounce unfakeable.
   */
  observedSince: Date | null;
  /** The agent's last report, and the last one somebody read. Equal means "seen". */
  reportHash: string | null;
  ackedReportHash: string | null;
  /** The model, permission level and effort this session was launched with. */
  launch: SessionLaunchFold;
}

export const INITIAL_SESSION_FOLD: SessionFold = {
  state: 'starting',
  stateSeq: 0,
  agentSessionId: null,
  lastEventAt: null,
  stoppedAt: null,
  name: null,
  nameSource: null,
  cwdCheckoutId: null,
  lastObservedState: null,
  observedSince: null,
  reportHash: null,
  ackedReportHash: null,
  launch: { model: null, permission: 'ask', effort: null },
};

/**
 * The level a session of `agent` is launched at, given what was asked for.
 *
 * The one place "unspecified" is decided. An agent the catalog gives approvals
 * gets the level asked for when it is one of the three, and `ask` otherwise —
 * never anything that escalates. An agent with none (the blank terminal) gets
 * null, whatever was asked, so a level cannot ride along from the last agent
 * the composer had picked. An agent this build does not know is treated as one
 * with approvals: `ask` is the safe reading of a session it cannot explain.
 */
export function launchPermissionFor(
  agent: string | null,
  requested: string | null | undefined,
): SessionPermissionDto | null {
  if (agent && isCodingAgentId(agent) && !CODING_AGENTS[agent].launch.permission) return null;
  return SESSION_PERMISSIONS.includes(requested as SessionPermissionDto)
    ? (requested as SessionPermissionDto)
    : 'ask';
}

/** Reads a string field off a payload of unknown shape, without casting at call sites. */
function stringField(payload: unknown, field: string): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const value = (payload as Record<string, unknown>)[field];
  return typeof value === 'string' && value.trim() ? value : null;
}

/**
 * The launch a `session.requested` payload states, narrowed once here so nothing
 * downstream casts.
 *
 * A value outside the union is dropped rather than kept: these arrive from a
 * request body that a Zod pipe has already checked, so an unknown level here is a
 * log written by something else — and `ask` is the safe reading of "unknown",
 * because the alternative is a session that asks for nothing.
 */
function launchOf(payload: unknown): SessionLaunchFold | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const launch = (payload as { launch?: unknown }).launch;
  if (typeof launch !== 'object' || launch === null) return null;
  const effort = stringField(launch, 'effort');
  return {
    model: stringField(launch, 'model'),
    permission: launchPermissionFor(
      stringField(payload, 'agent'),
      stringField(launch, 'permission'),
    ),
    effort: SESSION_EFFORTS.includes(effort as SessionEffortDto)
      ? (effort as SessionEffortDto)
      : null,
  };
}

function observedStateOf(payload: unknown): AgentObservedState | null {
  const value = stringField(payload, 'state');
  return AGENT_OBSERVED_STATES.includes(value as AgentObservedState)
    ? (value as AgentObservedState)
    : null;
}

/**
 * Apply one event. Pure, total, and order-dependent only through the columns it
 * moves — an event the fold does not recognise still moves `lastEventAt`, because
 * "when did anything last happen here" is true of every entry.
 */
export function foldSessionEvent(fold: SessionFold, event: SessionLogEntry): SessionFold {
  const next: SessionFold = { ...fold, lastEventAt: event.occurredAt };

  switch (event.kind) {
    case SESSION_EVENT_KINDS.REQUESTED:
      // The request is where the launch is stated, so it is where the projection
      // takes it. A payload without one folds to `ask` with no model, which is
      // what every session created before this field existed was launched with.
      next.launch = launchOf(event.payload) ?? next.launch;
      return transition(next, 'starting');
    case SESSION_EVENT_KINDS.STARTED: {
      // A start after a failure is a late event, not a recovery: the runner that
      // sends it has not heard about the failure. Only an explicit restart reopens
      // a failed session, which is the same reasoning that locks `resolved`.
      if (next.state === 'resolved' || next.state === 'failed') return next;
      return opened(next, event);
    }
    case SESSION_EVENT_KINDS.RESTARTED: {
      if (next.state === 'resolved') return next;
      return opened(next, event);
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
      const recorded = stringField(event.payload, 'source');
      const source: SessionNameSource =
        recorded === 'model' || recorded === 'prompt' ? recorded : 'user';
      // A title derived from the first prompt — by a model or from its words —
      // never overwrites a name a person typed, whichever order the two arrive in.
      if (source !== 'user' && next.nameSource === 'user') return next;
      next.name = name;
      next.nameSource = source;
      return next;
    }
    case SESSION_EVENT_KINDS.CWD_SET:
      next.cwdCheckoutId = stringField(event.payload, 'checkoutId');
      return next;
    case SESSION_EVENT_KINDS.CHECKOUT_REMOVED: {
      // The foreign key's `ON DELETE SET NULL` never fires, because checkout rows
      // are not deleted. Stepping the agent out of a retired checkout is the fold's
      // job, so a replay rebuilds it too.
      const checkoutId = stringField(event.payload, 'checkoutId');
      if (checkoutId && next.cwdCheckoutId === checkoutId) next.cwdCheckoutId = null;
      return next;
    }
    case SESSION_EVENT_KINDS.AGENT_OBSERVED: {
      const state = observedStateOf(event.payload);
      if (!state) return next;
      if (next.lastObservedState === state) {
        // The same state again: keep the transition already recorded, which is what
        // makes a duration accumulate instead of resetting on every heartbeat.
        next.observedSince = next.observedSince ?? event.occurredAt;
        return next;
      }
      // The first report of a state records the transition but claims no duration
      // yet — one report cannot be evidence of having been stuck.
      next.lastObservedState = state;
      next.observedSince = null;
      return next;
    }
    case SESSION_EVENT_KINDS.REPORT_PUBLISHED:
      next.reportHash = stringField(event.payload, 'hash') ?? next.reportHash;
      return next;
    case SESSION_EVENT_KINDS.REPORT_ACKNOWLEDGED:
      next.ackedReportHash = stringField(event.payload, 'hash') ?? next.ackedReportHash;
      return next;
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

/** A session that is running again: open, not stopped, and carrying the agent's id. */
function opened(fold: SessionFold, event: SessionLogEntry): SessionFold {
  const next = transition(fold, 'open');
  next.stoppedAt = null;
  next.agentSessionId = stringField(event.payload, 'agentSessionId') ?? next.agentSessionId;
  return next;
}

/**
 * Move to a state, bumping `stateSeq` only when the state actually changed.
 *
 * `resolved` is terminal. The row is a permanent tombstone — it is what stops a
 * new session inheriting a retired session's directory name and therefore a
 * stranger's agent conversation state — so nothing brings a closed session back.
 */
function transition(fold: SessionFold, state: SessionState): SessionFold {
  if (fold.state === 'resolved' || fold.state === state) return fold;
  return { ...fold, state, stateSeq: fold.stateSeq + 1 };
}
