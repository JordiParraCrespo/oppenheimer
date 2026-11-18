import { useEffect, useSyncExternalStore } from 'react';
import { sessionUnread } from '../lib/session-unread';

/** One row's unread mark, and the mark; re-renders when it changes, whoever wrote it. */
export function useSessionUnread(id: string) {
  const unread = useSyncExternalStore(sessionUnread.subscribe, () => sessionUnread.has(id));
  return { unread, setUnread: (next: boolean) => sessionUnread.set(id, next) };
}

/**
 * Opening a session takes its unread mark off, from wherever it was opened
 * (the sidebar, the inbox, a task, a link). Keyed on the session alone: one
 * marked while it is open keeps the mark until the reader comes back to it.
 */
export function useClearUnreadOnOpen(sessionId: string): void {
  // Syncs the device's unread marks (localStorage) with the session on screen.
  useEffect(() => sessionUnread.set(sessionId, false), [sessionId]);
}
