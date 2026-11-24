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
 * Tells the visit which item follows the one in hand (`key`), so the deck
 * goes on to it once that one leaves, however it leaves. Syncs with the
 * visit store outside React.
 */
export function useFollowNext(key: string | null, next: string | null): void {
  useEffect(() => {
    if (key) inboxVisit.follow(key, next);
  }, [key, next]);
}
