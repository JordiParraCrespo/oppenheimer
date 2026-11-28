import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { useEffect } from 'react';
import { inboxHeld } from '../lib/inbox-held';

/**
 * Holds the deck on `item` while `holding` (an open Reply here), and lets go
 * when it closes or the card leaves the deck. Syncs with the hold store
 * outside React (`inboxHeld`), which the listing reads.
 */
export function useInboxHold(item: InboxItem, holding: boolean): void {
  useEffect(() => {
    if (!holding) return;
    inboxHeld.hold(item);
    return () => inboxHeld.release(item.key);
  }, [holding, item]);
}
