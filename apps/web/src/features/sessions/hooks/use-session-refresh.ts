import type { StreamEnd } from '@oppenheimer/frontend-consumer';
import { useInvalidateSession } from '@oppenheimer/frontend-consumer/react';
import { useExpireSession } from '@oppenheimer/frontend-core/react';

/**
 * When the stream ends for good, the row has changed under the screen: a stop,
 * a close, a membership gone. The detail query has no polling of its own, so
 * without this a focused tab keeps its cached live session and sits on a dead
 * terminal. Refetching it is what turns the pane into the closed-session or
 * Restart state the screen already renders.
 *
 * `unauthorized` is the one end that is not about the session: the sign-in
 * itself is gone. Refetching would only answer 401 and draw a generic error,
 * so it takes the same path every 401 does — the auth store forgets the
 * session and the router sends the reader to sign in again.
 */
export function useSessionRefresh(sessionId: string): (reason: StreamEnd) => void {
  const refetch = useInvalidateSession(sessionId);
  const expire = useExpireSession();
  return (reason: StreamEnd) => {
    if (reason === 'unauthorized') expire();
    else refetch();
  };
}
