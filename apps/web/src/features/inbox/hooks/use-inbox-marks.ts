import type { InboxItem } from '@oppenheimer/frontend-consumer';
import {
  useDeleteInboxMark,
  usePutInboxMark,
  usePutInboxMarks,
} from '@oppenheimer/frontend-consumer/react';
import { inboxVisit } from '../lib/inbox-visit';

const HOUR = 60 * 60_000;

/** Tomorrow at nine, the reader's time: when "until tomorrow" brings an item back. */
function tomorrowMorning(now: Date): Date {
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);
  return next;
}

/**
 * What the row menu does to an item (§3), and E and L on the item in the
 * pane: each a stored mark; Mark as done also keeps it under Show done for
 * this visit. The `all…` ones do the same to a selection, in one write.
 * `error` is the last write the server refused; the list draws it.
 */
export function useInboxMarks() {
  // The stable parts only: the mutation result itself is a new object on
  // every render, and the rows' handlers are built from these.
  const { mutate: put, error: putError, reset: resetPut } = usePutInboxMark();
  const { mutate: clear, error: clearError, reset: resetClear } = useDeleteInboxMark();
  const { mutate: putAll, error: allError, reset: resetAll } = usePutInboxMarks();
  const keysOf = (items: readonly InboxItem[]) => items.map((item) => item.key);

  return {
    error: putError ?? clearError ?? allError,
    dismiss: () => {
      resetPut();
      resetClear();
      resetAll();
    },
    done(item: InboxItem) {
      put({ itemKey: item.key, mark: 'done' });
      inboxVisit.done(item.key);
    },
    toggleLow(item: InboxItem) {
      if (item.low) clear(item.key);
      else put({ itemKey: item.key, mark: 'low' });
    },
    snoozeHour(item: InboxItem) {
      put({ itemKey: item.key, mark: 'snoozed', until: new Date(Date.now() + HOUR) });
    },
    snoozeTomorrow(item: InboxItem) {
      put({ itemKey: item.key, mark: 'snoozed', until: tomorrowMorning(new Date()) });
    },
    /** Hides it for good; a done item leaves Show done too (Decided 4). */
    remove(item: InboxItem) {
      put({ itemKey: item.key, mark: 'deleted' });
      inboxVisit.forget(item.key);
    },
    bringBack(item: InboxItem) {
      clear(item.key);
    },
    allDone(items: readonly InboxItem[]) {
      putAll({ itemKeys: keysOf(items), mark: 'done' });
      for (const item of items) inboxVisit.done(item.key);
    },
    /** Deprioritizes them all, or restores them all when every one is already low. */
    allToggleLow(items: readonly InboxItem[]) {
      const restore = items.every((item) => item.low);
      putAll({ itemKeys: keysOf(items), mark: restore ? null : 'low' });
    },
    allSnoozeHour(items: readonly InboxItem[]) {
      putAll({ itemKeys: keysOf(items), mark: 'snoozed', until: new Date(Date.now() + HOUR) });
    },
    allSnoozeTomorrow(items: readonly InboxItem[]) {
      putAll({ itemKeys: keysOf(items), mark: 'snoozed', until: tomorrowMorning(new Date()) });
    },
    allRemove(items: readonly InboxItem[]) {
      putAll({ itemKeys: keysOf(items), mark: 'deleted' });
      for (const item of items) inboxVisit.forget(item.key);
    },
  };
}
