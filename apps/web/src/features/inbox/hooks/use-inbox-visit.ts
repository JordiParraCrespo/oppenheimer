import { useEffect, useSyncExternalStore } from 'react';
import { type InboxVisit, inboxVisit } from '../lib/inbox-visit';

/** This visit's Later order and done keys; the list and the pane read the same one. */
export function useInboxVisit(): InboxVisit {
  return useSyncExternalStore(inboxVisit.subscribe, inboxVisit.get, inboxVisit.get);
}

/**
 * Forgets the visit when the reader leaves the Inbox (Show done lasts until
 * you leave). Syncs with the visit store outside React.
 */
export function useForgetVisitOnLeave(): void {
  useEffect(() => () => inboxVisit.clear(), []);
}

/**
 * Tells the visit which item follows the one in hand, so the deck goes on to
 * it once that one leaves, however it leaves. `undefined` writes nothing:
 * while the deck draws a stand-in for an item that left, the stand-in was
 * chosen by `next`, and following it would chase the stack to its end.
 * Syncs with the visit store outside React.
 */
export function useFollowNext(next: string | null | undefined): void {
  useEffect(() => {
    if (next !== undefined) inboxVisit.follow(next);
  }, [next]);
}
