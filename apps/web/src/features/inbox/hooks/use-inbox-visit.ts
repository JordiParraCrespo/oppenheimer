import { useEffect, useSyncExternalStore } from 'react';
import { type InboxVisit, inboxVisit } from '../lib/inbox-visit';

/** This visit's log, Later order, done and answered keys; the list and the pane read the same one. */
export function useInboxVisit(): InboxVisit {
  return useSyncExternalStore(inboxVisit.subscribe, inboxVisit.get, inboxVisit.get);
}

/**
 * Forgets the visit when the reader leaves the Inbox (§5: the log and Show
 * done last "until you leave"). Syncs with the visit store outside React.
 */
export function useForgetVisitOnLeave(): void {
  useEffect(() => () => inboxVisit.clear(), []);
}
