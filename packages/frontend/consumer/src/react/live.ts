'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useConsumerApp } from './context';
import { LIVE_COVERED, readsOf } from './live-reads';

/**
 * Open the live stream while `enabled` holds, and make stale what each event
 * names (`live-reads.ts`). The app mounts it once, in the shell every
 * signed-in screen shares.
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
    const stale = (queryKey: readonly unknown[]) =>
      void queryClient.invalidateQueries({ queryKey });
    const offEvent = live.onEvent((event) => readsOf(event).forEach(stale));
    const offStatus = live.onStatus((status) => {
      if (status === 'live') LIVE_COVERED.forEach(stale);
    });
    live.start();
    return () => {
      offEvent();
      offStatus();
      live.stop();
    };
  }, [app, queryClient, enabled]);
}
