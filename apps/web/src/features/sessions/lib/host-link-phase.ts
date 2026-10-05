import type { HostLinkPhase } from '@oppenheimer/design-system-web';
import type { StreamStatus } from '@oppenheimer/frontend-consumer';

/** How long the pane says Reconnected before it goes back to Live. */
export const RECONNECTED_FOR_MS = 3000;

/**
 * Where the pane's link to its host stands, as the design system's phases
 * (`HostLinkChrome`), from what the stream and the host list say.
 *
 * - `offline` is the relay's `host_offline`; once a poll since then finds the
 *   host again it is `catching-up`, the runner back and the redial on its way.
 * - `connecting` is `reconnecting`, a blip, unless the link was away, when it
 *   is still the host coming back (`catching-up`).
 * - `live` reads `reconnected` for a moment after coming back from away.
 * - `closed` has no phase: the stream ended, and the pane says why itself.
 */
export function hostLinkPhaseOf({
  status,
  away,
  hostBack,
  reconnected,
}: {
  status: StreamStatus;
  away: boolean;
  hostBack: boolean;
  reconnected: boolean;
}): HostLinkPhase | null {
  switch (status) {
    case 'offline':
      return hostBack ? 'catching-up' : 'offline';
    case 'connecting':
      return away ? 'catching-up' : 'reconnecting';
    case 'live':
      return reconnected ? 'reconnected' : 'live';
    default:
      return null;
  }
}
