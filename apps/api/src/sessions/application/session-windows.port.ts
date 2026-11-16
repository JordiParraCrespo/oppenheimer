import type { SessionWindowAgent } from '@oppenheimer/shared';
import type { SessionWindowsMessage } from '@oppenheimer/shared/protocol';

/** One tmux window of a session, as its runner listed it. */
export type SessionWindowListing = SessionWindowsMessage['windows'][number];

/**
 * What asking a session's host about its windows came back with: the windows
 * after the command (and, for an open, the window it made), the reason
 * nothing was asked (no link, or a runner that does not answer window
 * commands), no answer in time, or the runner's refusal with its catalog code
 * (`SESS_002` window 0, `SESS_001` no such window or session).
 */
export type SessionWindowsOutcome =
  | { kind: 'listed'; windows: SessionWindowListing[]; opened?: number }
  | { kind: 'host_offline' }
  | { kind: 'not_supported' }
  | { kind: 'timed_out' }
  | { kind: 'failed'; code: string; detail?: string };

/**
 * What an open came back with: any of the above, or, for an open that asked
 * for a second agent, a live runner that does not start one in a window
 * (its hello did not name `session.window.agent`), so nothing was asked.
 */
export type SessionWindowOpenOutcome = SessionWindowsOutcome | { kind: 'agent_not_supported' };

/**
 * What the module that owns the runner link implements so the session pane's
 * Terminal tab can list, open and close a session's plain shells: tmux windows
 * 1 and up, window 0 being the agent. Like `SessionPortsPort` it waits for the
 * runner's answer, and nothing is stored.
 */
export interface SessionWindowsPort {
  list(hostId: string, sessionId: string): Promise<SessionWindowsOutcome>;
  /** A plain shell, or with `agent` that coding agent started in the new window. */
  open(
    hostId: string,
    sessionId: string,
    agent?: SessionWindowAgent,
  ): Promise<SessionWindowOpenOutcome>;
  close(hostId: string, sessionId: string, window: number): Promise<SessionWindowsOutcome>;
}
