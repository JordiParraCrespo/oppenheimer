'use client';

import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';

interface StreamStatus {
  live: boolean;
  listeners: Set<() => void>;
}

/**
 * Whether the workspace event stream is live, per `QueryClient`: the stream
 * that refreshes a cache is the one whose polls it may stand down.
 */
const statuses = new WeakMap<QueryClient, StreamStatus>();

function statusOf(queryClient: QueryClient): StreamStatus {
  let status = statuses.get(queryClient);
  if (!status) {
    status = { live: false, listeners: new Set() };
    statuses.set(queryClient, status);
  }
  return status;
}

/** Written by `useWorkspaceEvents` alone, as its stream comes up and goes down. */
export function setWorkspaceStreamLive(queryClient: QueryClient, live: boolean): void {
  const status = statusOf(queryClient);
  if (status.live === live) return;
  status.live = live;
  for (const listener of status.listeners) listener();
}

/**
 * Whether the workspace event stream is live right now, so a query whose
 * changes it carries need not poll: the hook spreads `NO_POLL` after its
 * `pollWhile` while this holds. False until the stream says `ready`, and
 * again the moment it drops, which gives the poll back.
 */
export function useWorkspaceStreamLive(): boolean {
  const status = statusOf(useQueryClient());
  const subscribe = useCallback(
    (onChange: () => void) => {
      status.listeners.add(onChange);
      return () => status.listeners.delete(onChange);
    },
    [status],
  );
  return useSyncExternalStore(
    subscribe,
    () => status.live,
    () => false,
  );
}
