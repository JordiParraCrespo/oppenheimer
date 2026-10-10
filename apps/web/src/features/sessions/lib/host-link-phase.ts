import type { HostLinkPhase } from '@oppenheimer/design-system-web';
import type { StreamStatus } from '@oppenheimer/frontend-consumer';

/** How long the pane says Reconnected before it goes back to Live. */
export const RECONNECTED_FOR_MS = 3000;

/**
 * How long a dial runs before the pane calls it reconnecting. Opening a
 * session, or switching to one, dials too, and that dial lands well inside
 * this; saying "Connecting to …" with Retry now for it flashed on every switch.
 */
export const DIAL_GRACE_MS = 2000;

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
 *   is the host coming back (`catching-up`). A dial still inside its grace
 *   (`slow` false) has no phase yet: the pane draws a plain status bar.
 * - `live` reads `reconnected` for a moment after coming back from away.
 * - `closed` has no phase: the stream ended, and the pane says why itself.
 */
export function hostLinkPhaseOf({
  status,
  away,
  reconnected,
  slow,
}: {
  status: StreamStatus;
  away: boolean;
  reconnected: boolean;
  /** The dial has outlasted `DIAL_GRACE_MS`. */
  slow: boolean;
}): HostLinkPhase | null {
  switch (status) {
    case 'offline':
      return 'offline';
    case 'connecting':
      if (away) return 'catching-up';
      return slow ? 'reconnecting' : null;
    case 'live':
      return reconnected ? 'reconnected' : 'live';
    default:
      return null;
  }
}
