import { IconButton, InboxClear, InboxToolbar, useNow } from '@oppenheimer/design-system-web';
import {
  Check,
  ChevronLeft,
  Clock,
  TrendingDown,
  TrendingUp,
  X,
} from '@oppenheimer/design-system-web/icons';
import { useSessions } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatAge } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useInboxKeys } from '@/features/inbox/hooks/use-inbox-keys';
import { useInboxListing } from '@/features/inbox/hooks/use-inbox-listing';
import { useInboxMarks } from '@/features/inbox/hooks/use-inbox-marks';
import { useMarkRead } from '@/features/inbox/hooks/use-inbox-read';
import { inboxCopy, inboxFrom } from '@/features/inbox/lib/inbox-copy';
import { InboxItemMessage } from '@/features/inbox/sections/inbox-item-message';

/**
 * The reading pane (`29-inbox.md` §5, the 2026-10-29 frame): a toolbar that
 * marks the item done, snoozes it until tomorrow, deprioritizes or deletes
 * it, with its place in the list; under it the item as a message with its
 * answers — or "Nothing needs you". It takes its item from the same list the
 * column draws, under the same filter and search; E and L act on it, and
 * showing it marks it read.
 */
export function InboxCurrent() {
  const { t } = useTranslation();
  const now = useNow(60_000);
  const { inbox, search, open, current: item } = useInboxListing(now);
  const marks = useInboxMarks();
  const { data: running } = useSessions({
    select: (rows) => rows.filter((session) => session.isLive).length,
  });

  const copy = item ? inboxCopy(item, t) : null;
  useMarkRead(item?.key ?? null, search.item !== null);
  useInboxKeys(
    item ? { onDone: () => marks.done(item), onLow: () => marks.toggleLow(item) } : null,
  );

  const back = (
    <IconButton
      className="md:hidden"
      aria-label={t('inbox.pane.back')}
      render={<Link to="/plan/inbox" search={(previous) => ({ ...previous, item: undefined })} />}
    >
      <ChevronLeft />
    </IconButton>
  );
  const projectName = (id: string) => inbox.projects.find((project) => project.id === id)?.name;
  const errors = (
    <>
      {inbox.error ? (
        <ErrorAlert error={inbox.error} fallback={t('inbox.list.failed')} className="mx-8 mt-6" />
      ) : null}
      {marks.error ? (
        <ErrorAlert
          error={marks.error}
          fallback={t('inbox.list.markFailed')}
          onDismiss={marks.dismiss}
          className="mx-8 mt-6"
        />
      ) : null}
    </>
  );

  if (!item || !copy) {
    return (
      <>
        {/* On a phone the list stays hidden while the address names an item,
            so the way back to it outlives the last item leaving. */}
        {search.item !== null ? (
          <InboxToolbar aria-label={t('inbox.pane.toolbar')} className="md:hidden">
            {back}
          </InboxToolbar>
        ) : null}
        {errors}
        <InboxClear title={t('inbox.pane.clearTitle')}>
          {running ? t('inbox.pane.clearRunning', { count: running }) : t('inbox.pane.clear')}
        </InboxClear>
      </>
    );
  }

  const from = inboxFrom(item, copy.source, projectName);
  // "6m ago", but "now" alone for what came in this minute.
  const age =
    now - item.since.getTime() < 60_000
      ? formatAge(item.since, now, t)
      : t('inbox.pane.ago', { age: formatAge(item.since, now, t) });
  return (
    <>
      <InboxToolbar
        aria-label={t('inbox.pane.toolbar')}
        position={t('inbox.pane.position', { n: open.indexOf(item) + 1, total: open.length })}
      >
        {back}
        <IconButton aria-label={t('inbox.menu.done')} onClick={() => marks.done(item)}>
          <Check />
        </IconButton>
        <IconButton
          aria-label={t('inbox.menu.snoozeTomorrow')}
          onClick={() => marks.snoozeTomorrow(item)}
        >
          <Clock />
        </IconButton>
        <IconButton
          aria-label={item.low ? t('inbox.menu.restore') : t('inbox.menu.low')}
          onClick={() => marks.toggleLow(item)}
        >
          {item.low ? <TrendingUp /> : <TrendingDown />}
        </IconButton>
        <IconButton aria-label={t('inbox.menu.delete')} onClick={() => marks.remove(item)}>
          <X />
        </IconButton>
      </InboxToolbar>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {errors}
        <InboxItemMessage item={item} copy={copy} from={from} age={age} />
      </div>
    </>
  );
}
