import type { HostLinkPhase } from '@oppenheimer/design-system-web';
import type { StreamStatus } from '@oppenheimer/frontend-consumer';

/** How long the pane says Reconnected before it goes back to Live. */
export const RECONNECTED_FOR_MS = 3000;

/**
 * Where the pane's link to its host stands, as the design system's phases
 * (`HostLinkChrome`), from what the stream and the host list say.
 *
 * - `offline` is the relay's `host_offline`, and stays offline until the
 *   stream is attached again. The host list finding the host is not enough to
 *   say it is back: the API calls a host online for thirty seconds after its
 *   last heartbeat, so a runner that has just died still reads online, and a
 *   banner saying "Runner is back" over a dead runner sends the reader away
 *   from the fix. That reading only redials (`useTerminal`).
 * - `connecting` is `reconnecting`, a blip, unless the link was away, when it
 *   is the host coming back (`catching-up`).
 * - `live` reads `reconnected` for a moment after coming back from away.
 * - `closed` has no phase: the stream ended, and the pane says why itself.
 */
export function hostLinkPhaseOf({
  status,
  away,
  reconnected,
}: {
  status: StreamStatus;
  away: boolean;
  reconnected: boolean;
}): HostLinkPhase | null {
  switch (status) {
    case 'offline':
      return 'offline';
    case 'connecting':
      return away ? 'catching-up' : 'reconnecting';
    case 'live':
      return reconnected ? 'reconnected' : 'live';
    default:
      return null;
  }
}
