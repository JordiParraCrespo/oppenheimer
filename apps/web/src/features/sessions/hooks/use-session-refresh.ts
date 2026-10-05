import type { StreamEnd } from '@oppenheimer/frontend-consumer';
import { useInvalidateSession } from '@oppenheimer/frontend-consumer/react';
import { useExpireSession } from '@oppenheimer/frontend-core/react';

/**
 * When the stream ends for good the row has changed under the screen (a stop,
 * a close, a membership gone), and the detail query does not poll, so a
 * refetch is what turns a dead terminal into the closed or Restart state.
 * `unauthorized` means the sign-in itself is gone: a refetch would only 401,
 * so it expires the session like every 401 and the router sends the reader to
 * sign in.
 */
export function useSessionRefresh(sessionId: string): (reason: StreamEnd) => void {
  const refetch = useInvalidateSession(sessionId);
  const expire = useExpireSession();
  return (reason: StreamEnd) => {
    if (reason === 'unauthorized') expire();
    else refetch();
  };
}
