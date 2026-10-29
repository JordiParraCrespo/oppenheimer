import { useEffect, useSyncExternalStore } from 'react';
import { inboxRead } from '../lib/inbox-read';

/** The keys of the items the reader has opened on this device. */
export function useInboxRead(): ReadonlySet<string> {
  return useSyncExternalStore(inboxRead.subscribe, inboxRead.get, inboxRead.get);
}

/** The width from which the list and the reading pane stand side by side (`md`). */
const SIDE_BY_SIDE = '(min-width: 768px)';

/**
 * Marks the item in the reading pane read once it is shown. Syncs the read
 * store (this device's storage) with what is on screen: on a phone the pane
 * shows only once an item is `opened`, so the first item it would hold is
 * not read just for being first.
 */
export function useMarkRead(key: string | null, opened: boolean): void {
  useEffect(() => {
    if (key && (opened || window.matchMedia(SIDE_BY_SIDE).matches)) inboxRead.mark(key);
  }, [key, opened]);
}
