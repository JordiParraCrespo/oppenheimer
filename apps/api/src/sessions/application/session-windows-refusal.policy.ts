import { AppError } from '@oppenheimer/backend-core';
import type { SessionTerminalWindow } from '@oppenheimer/shared';
import { SessionErrors } from '../domain/sessions.errors';
import type { SessionWindowListing, SessionWindowsOutcome } from './session-windows.port';

/** The runner's `SESS_001`: no such session or window on the host. */
const RUNNER_NOT_FOUND = 'SESS_001';

/** A window as the console reads it: window 0 is the agent's, the rest are shells. */
export function toTerminalWindow(window: SessionWindowListing): SessionTerminalWindow {
  const agent = window.index === 0;
  return { index: window.index, name: window.name || (agent ? 'agent' : 'shell'), agent };
}

/**
 * The windows a host answered an open or a close with, or the problem for why
 * there are none. Total over the runner's codes: `SESS_001` is a window (or
 * session) the host does not hold, and any other refusal is `SESSIONS_059`
 * with the runner's code kept as `upstreamCode`, so a code a later runner adds
 * is still a documented problem. Not reaching the host is `SESSIONS_016`, a
 * runner too old to answer `SESSIONS_056`, no answer in time `SESSIONS_031`.
 */
export function changedOrThrow(
  outcome: SessionWindowsOutcome,
  hostId: string,
): { windows: SessionTerminalWindow[]; opened?: number } {
  switch (outcome.kind) {
    case 'listed':
      return {
        windows: outcome.windows.map(toTerminalWindow),
        ...(outcome.opened !== undefined ? { opened: outcome.opened } : {}),
      };
    case 'host_offline':
      throw new AppError(SessionErrors.HOST_OFFLINE, {
        detail: `Host ${hostId} holds no link right now`,
      });
    case 'not_supported':
      throw new AppError(SessionErrors.WINDOWS_UNSUPPORTED_BY_RUNNER, {
        detail: `Update the runner on host ${hostId} to open terminals in a session`,
      });
    case 'timed_out':
      throw new AppError(SessionErrors.FOLDERS_TIMED_OUT, {
        detail: `Host ${hostId} did not answer in time`,
      });
    case 'failed':
      throw new AppError(
        outcome.code === RUNNER_NOT_FOUND
          ? SessionErrors.WINDOW_NOT_FOUND
          : SessionErrors.WINDOW_REFUSED,
        {
          detail: outcome.detail ?? `Host ${hostId} refused`,
          extensions: { upstreamCode: outcome.code },
        },
      );
  }
}
