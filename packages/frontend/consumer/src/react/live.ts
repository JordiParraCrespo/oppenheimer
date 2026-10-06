'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useConsumerApp } from './context';
import { sessionsKeys } from './sessions.queries';

/**
 * Open the live stream while `enabled` holds, and turn what it says into reads:
 * a changed session reads its row and the lists again. The app mounts it once,
 * in the shell every signed-in screen shares.
 *
 * Each time the stream comes up, first dial or a dial after a drop, every read
 * it covers is read again: nothing says what changed while it was down.
 */
export function useLiveEvents(enabled: boolean): void {
  const app = useConsumerApp();
  const queryClient = useQueryClient();

  // The API's live stream, an EventSource the browser keeps dialling.
  useEffect(() => {
    if (!enabled) return;
    const live = app.live;
    const offEvent = live.onEvent((event) => {
      if (event.type !== 'session.changed') return;
      void queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(event.sessionId) });
      void queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
    });
    const offStatus = live.onStatus((status) => {
      if (status === 'live') void queryClient.invalidateQueries({ queryKey: sessionsKeys.all });
    });
    live.start();
    return () => {
      offEvent();
      offStatus();
      live.stop();
    };
  }, [app, queryClient, enabled]);
}
