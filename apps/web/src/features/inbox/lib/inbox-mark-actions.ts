import type { InboxItem, InboxMark } from '@oppenheimer/frontend-consumer';
import { inboxVisit } from './inbox-visit';

const HOUR = 60 * 60_000;

/** Tomorrow at nine, the reader's time: when "until tomorrow" brings an item back. */
function tomorrowMorning(now: Date): Date {
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);
  return next;
}

/** What an action stores on each item it is given: a mark, or `null` to clear the one there. */
export interface InboxMarkWrite {
  mark: InboxMark | null;
  until?: Date;
}

export type InboxMarkActionName =
  | 'done'
  | 'toggleLow'
  | 'snoozeHour'
  | 'snoozeTomorrow'
  | 'remove'
  | 'bringBack';

interface InboxMarkAction {
  write: (items: readonly InboxItem[], now: Date) => InboxMarkWrite;
  /** What this visit remembers of each key, for Show done. */
  visit?: (key: string) => void;
}

/**
 * What the Inbox can do to items (§3), one entry each, the same for one row
 * (its menu, the pane's toolbar, E and L) as for a selection (the bulk bar).
 * Mark as done also keeps the items under Show done for this visit; Delete
 * takes them out of it (Decided 4). Deprioritize restores priority instead
 * when every item is already low.
 */
export const INBOX_MARK_ACTIONS: Record<InboxMarkActionName, InboxMarkAction> = {
  done: { write: () => ({ mark: 'done' }), visit: (key) => inboxVisit.done(key) },
  toggleLow: { write: (items) => ({ mark: items.every((item) => item.low) ? null : 'low' }) },
  snoozeHour: {
    write: (_, now) => ({ mark: 'snoozed', until: new Date(now.getTime() + HOUR) }),
  },
  snoozeTomorrow: { write: (_, now) => ({ mark: 'snoozed', until: tomorrowMorning(now) }) },
  remove: { write: () => ({ mark: 'deleted' }), visit: (key) => inboxVisit.forget(key) },
  bringBack: { write: () => ({ mark: null }) },
};
