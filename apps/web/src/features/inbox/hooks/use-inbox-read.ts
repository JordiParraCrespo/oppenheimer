import { useEffect, useSyncExternalStore } from 'react';
import { inboxRead } from '../lib/inbox-read';

/** The keys of the items the reader has opened on this device. */
export function useInboxRead(): ReadonlySet<string> {
  return useSyncExternalStore(inboxRead.subscribe, inboxRead.get, inboxRead.get);
}

/**
 * Marks the item in the reading pane read once it is shown. Syncs the read
 * store (this device's storage) with what is on screen.
 */
export function useMarkRead(key: string | null): void {
  useEffect(() => {
    if (key) inboxRead.mark(key);
  }, [key]);
}
