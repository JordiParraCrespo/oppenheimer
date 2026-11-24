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
  /** The source an item's action also puts away for good: a task's id to take up, or null. */
  takesUp?: (item: InboxItem) => string | null;
}

/** A task an agent made, which Delete takes up (its Dismiss), as no mark can bring it back. */
const taskOf = (item: InboxItem): string | null => (item.kind === 'task' ? item.task.id : null);

/**
 * What the Inbox can do to items, one entry each, the same for one row (its
 * menu, the pane's toolbar, E and L) as for a selection (the bulk bar). Mark
 * as done also keeps the items under Show done for this visit; Delete takes
 * them out of it. Deprioritize restores priority instead when every item is
 * already low. Mark as done and Delete also take up a task an agent made, so
 * it leaves the Inbox for good and stays on the board as it is (the card's
 * Dismiss before 2026-11-24).
 * Every action that takes an item out of the list counts it as cleared for
 * the deck's progress.
 */
export const INBOX_MARK_ACTIONS: Record<InboxMarkActionName, InboxMarkAction> = {
  done: { write: () => ({ mark: 'done' }), visit: (key) => inboxVisit.done(key), takesUp: taskOf },
  toggleLow: { write: (items) => ({ mark: items.every((item) => item.low) ? null : 'low' }) },
  snoozeHour: {
    write: (_, now) => ({ mark: 'snoozed', until: new Date(now.getTime() + HOUR) }),
    visit: (key) => inboxVisit.cleared(key),
  },
  snoozeTomorrow: {
    write: (_, now) => ({ mark: 'snoozed', until: tomorrowMorning(now) }),
    visit: (key) => inboxVisit.cleared(key),
  },
  remove: {
    write: () => ({ mark: 'deleted' }),
    visit: (key) => inboxVisit.forget(key),
    takesUp: taskOf,
  },
  bringBack: { write: () => ({ mark: null }) },
};
