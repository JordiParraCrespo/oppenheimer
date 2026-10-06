'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useConsumerApp } from './context';

/**
 * Whether the live stream is up, so a query whose changes it carries need not
 * poll (`pollWhile`'s `streamed`). False until the stream answers, and again
 * the moment it drops.
 */
export function useLiveStreamed(): boolean {
  const live = useConsumerApp().live;
  const subscribe = useCallback((onChange: () => void) => live.onStatus(onChange), [live]);
  return useSyncExternalStore(
    subscribe,
    () => live.status() === 'live',
    () => false,
  );
}
