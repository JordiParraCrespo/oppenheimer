import { sessionsKeys } from '@oppenheimer/frontend-consumer/react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { StreamEnd } from '../lib/session-stream';

/**
 * When the stream ends for good, the row has changed under the screen: a stop,
 * a close, a membership gone. The detail query has no polling of its own, so
 * without this a focused tab keeps its cached live session and sits on a dead
 * terminal. Invalidating it is what turns the pane into the closed-session or
 * Restart state the screen already renders.
 */
export function useSessionRefresh(sessionId: string): (reason: StreamEnd) => void {
  const queryClient = useQueryClient();
  return useCallback(
    (_reason: StreamEnd) => {
      void queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(sessionId) });
    },
    [queryClient, sessionId],
  );
}
