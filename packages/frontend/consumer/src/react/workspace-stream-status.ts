'use client';

import { type QueryClient, type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';

interface StreamStatus {
  live: boolean;
  /** Whether the stream announces every change to this read (`workspace-events.ts`). */
  covers: (queryKey: QueryKey) => boolean;
  listeners: Set<() => void>;
}

/**
 * The workspace event stream as the polls see it, per `QueryClient`: the
 * stream that refreshes a cache is the one whose polls it may stand down.
 * `useWorkspaceEvents` writes it; `usePollWhile` is its one reader.
 */
const statuses = new WeakMap<QueryClient, StreamStatus>();

function statusOf(queryClient: QueryClient): StreamStatus {
  let status = statuses.get(queryClient);
  if (!status) {
    status = { live: false, covers: () => false, listeners: new Set() };
    statuses.set(queryClient, status);
  }
  return status;
}

export function setWorkspaceStream(
  queryClient: QueryClient,
  live: boolean,
  covers: (queryKey: QueryKey) => boolean,
): void {
  const status = statusOf(queryClient);
  status.covers = covers;
  if (status.live === live) return;
  status.live = live;
  for (const listener of status.listeners) listener();
}

/** Whether the stream is live and announces every change to `queryKey`. */
export function useStreamCovers(queryKey: QueryKey): boolean {
  const status = statusOf(useQueryClient());
  const subscribe = useCallback(
    (onChange: () => void) => {
      status.listeners.add(onChange);
      return () => status.listeners.delete(onChange);
    },
    [status],
  );
  const live = useSyncExternalStore(
    subscribe,
    () => status.live,
    () => false,
  );
  return live && status.covers(queryKey);
}
