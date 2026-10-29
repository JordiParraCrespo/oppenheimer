import { IconButton, InboxClear, InboxToolbar, useNow } from '@oppenheimer/design-system-web';
import {
  Check,
  ChevronLeft,
  Clock,
  TrendingDown,
  TrendingUp,
  X,
} from '@oppenheimer/design-system-web/icons';
import { useSessions, useSuspenseInbox } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatAge } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useInboxKeys } from '@/features/inbox/hooks/use-inbox-keys';
import { useInboxMarks } from '@/features/inbox/hooks/use-inbox-marks';
import { useMarkRead } from '@/features/inbox/hooks/use-inbox-read';
import { useInboxSearch } from '@/features/inbox/hooks/use-inbox-search';
import { useInboxVisit } from '@/features/inbox/hooks/use-inbox-visit';
import { inboxCopy, inboxFrom, matchesQuery } from '@/features/inbox/lib/inbox-copy';
import { currentItem } from '@/features/inbox/lib/inbox-current';
import { listedItems } from '@/features/inbox/lib/inbox-filter';
import { InboxApprovalCard } from '@/features/inbox/sections/inbox-approval-card';
import { InboxPullCard } from '@/features/inbox/sections/inbox-pull-card';
import { InboxRunCard } from '@/features/inbox/sections/inbox-run-card';
import { InboxSessionCard } from '@/features/inbox/sections/inbox-session-card';

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
  const inbox = useSuspenseInbox(now);
  const visit = useInboxVisit();
  const search = useInboxSearch();
  const marks = useInboxMarks();
  const { data: running } = useSessions({
    select: (rows) => rows.filter((session) => session.isLive).length,
  });

  const found = (entry: (typeof inbox.open)[number]) =>
    matchesQuery(inboxCopy(entry, t), search.query);
  const { open } = listedItems(inbox, visit, search.filter, search.showDone, found);
  const item = currentItem(open, search.item, { answered: inbox.answered, done: visit.done });
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
  // Keyed by the item, so the next one rises in fresh, with its own answer state.
  const message = (() => {
    switch (item.kind) {
      case 'approval':
        return <InboxApprovalCard key={item.key} item={item} copy={copy} from={from} age={age} />;
      case 'pull':
        return <InboxPullCard key={item.key} item={item} copy={copy} from={from} age={age} />;
      case 'run':
        return <InboxRunCard key={item.key} item={item} copy={copy} from={from} age={age} />;
      case 'session':
        // By the session, so a refused answer stays over the decision it now waits on.
        return (
          <InboxSessionCard
            key={`session:${item.session.id}`}
            item={item}
            copy={copy}
            from={from}
            age={age}
          />
        );
    }
  })();

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
        {message}
      </div>
    </>
  );
}
