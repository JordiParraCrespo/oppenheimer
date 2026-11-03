/**
 * When a client of the API (`opp`, the MCP server) may stop waiting on a
 * session. Pure: each client polls with its own HTTP client and asks these.
 *
 * Zod-free, like the rest of `sessions/`, so the MCP server's Zod 4 never
 * meets this package's Zod 3 through it.
 */

/** A session as `GET /sessions/{id}` answers it, narrowed to what a wait reads. */
export interface SessionWaitView {
  /** The stored lifecycle: `starting`, `open`, `failed` or `resolved`. */
  lifecycle: string;
  /** The derived group: `working`, `waiting-on-you`, `ready-for-review`, `idle`… */
  state: string;
}

/** One entry of `GET /sessions/{id}/events`, narrowed to what a wait reads. */
export interface SessionLogEntry {
  seq: number;
  kind: string;
  payload: Record<string, unknown>;
}

/** The log entry a runner records for what it saw the agent doing. */
const AGENT_OBSERVED = 'agent.observed';

/** What the agent is seen doing once it has taken work: busy on it, or stopped on a question. */
const TAKING_WORK = new Set(['working', 'blocked']);

/**
 * Whether a session no longer needs time: it ended (failed or closed), or it
 * is open and its agent is not working: through with its task, or waiting on
 * somebody. A session still starting is never settled.
 *
 * Alone this cannot tell a finished task from one the agent has not started:
 * a prompt just sent leaves the session `idle` until the agent is seen on it.
 * A wait on a prompt asks {@link agentTookWorkAfter} as well.
 */
export function isSessionSettled(session: SessionWaitView): boolean {
  if (session.lifecycle === 'failed' || session.lifecycle === 'resolved') return true;
  if (session.lifecycle === 'starting') return false;
  return session.state !== 'working';
}

/**
 * Whether the log shows the agent taking work after `afterSeq`: an observation
 * of it working or blocked. The log is append-only, so a task the agent began
 * and finished between two reads still shows here, where the session's
 * current state would already read `idle` again.
 */
export function agentTookWorkAfter(entries: readonly SessionLogEntry[], afterSeq: number): boolean {
  return entries.some(
    (entry) =>
      entry.seq > afterSeq &&
      entry.kind === AGENT_OBSERVED &&
      TAKING_WORK.has(String(entry.payload.state)),
  );
}

/**
 * Whether a wait on work given at `afterSeq` (a prompt sent, a first task) is
 * over: the session ended, or the agent took the work and is no longer busy
 * with it. `tookWork` is {@link agentTookWorkAfter} over the log read so far.
 */
export function isWorkSettled(session: SessionWaitView, tookWork: boolean): boolean {
  if (session.lifecycle === 'failed' || session.lifecycle === 'resolved') return true;
  return tookWork && isSessionSettled(session);
}
