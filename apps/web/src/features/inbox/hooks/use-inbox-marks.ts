import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { useDeleteInboxMark, usePutInboxMark } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
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
 * pane: each a stored mark, and for Mark as done a line in this visit's log.
 * `error` is the last write the server refused; the list draws it.
 */
export function useInboxMarks() {
  const { t } = useTranslation();
  // The stable parts only: the mutation result itself is a new object on
  // every render, and the rows' handlers are built from these.
  const { mutate: put, error: putError, reset: resetPut } = usePutInboxMark();
  const { mutate: clear, error: clearError, reset: resetClear } = useDeleteInboxMark();

  return {
    error: putError ?? clearError,
    dismiss: () => {
      resetPut();
      resetClear();
    },
    done(item: InboxItem, short: string) {
      put({ itemKey: item.key, mark: 'done' });
      inboxVisit.done(item.key);
      inboxVisit.log(t('inbox.log.done', { title: short }));
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
    /** Hides it for good, with no log line; a done item leaves Show done too (Decided 4). */
    remove(item: InboxItem) {
      put({ itemKey: item.key, mark: 'deleted' });
      inboxVisit.forget(item.key);
    },
    bringBack(item: InboxItem) {
      clear(item.key);
    },
  };
}
