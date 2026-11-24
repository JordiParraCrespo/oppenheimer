import {
  Button,
  IconButton,
  InboxListHead,
  InboxList as InboxRows,
  InboxSnoozedRow,
  SidebarEmptyRow,
  SidebarListHead,
  useIsMobile,
  useNow,
} from '@oppenheimer/design-system-web';
import { ListChecks, RotateCwIcon } from '@oppenheimer/design-system-web/icons';
import { useInboxPullsShown, useRefreshInbox } from '@oppenheimer/frontend-consumer/react';
import {
  dateFormatter,
  ErrorAlert,
  formatAge,
  SidebarSearchField,
  useLocale,
  useMultiSelection,
} from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InboxFilterChips } from '@/features/inbox/components/inbox-filter-chips';
import { InboxFilterMenu } from '@/features/inbox/components/inbox-filter-menu';
import { InboxSelectionBar } from '@/features/inbox/components/inbox-selection-bar';
import { useAlertSwitch } from '@/features/inbox/hooks/use-alert-permission';
import { useInboxSelectKeys } from '@/features/inbox/hooks/use-inbox-keys';
import { useInboxListing } from '@/features/inbox/hooks/use-inbox-listing';
import { useInboxMarks } from '@/features/inbox/hooks/use-inbox-marks';
import { useInboxRead } from '@/features/inbox/hooks/use-inbox-read';
import { inboxCopy } from '@/features/inbox/lib/inbox-copy';
import { facetCounts } from '@/features/inbox/lib/inbox-filter';
import type { InboxMarkActionName } from '@/features/inbox/lib/inbox-mark-actions';
import { ALL_PROJECTS, NO_PROJECT } from '@/features/inbox/lib/inbox-search';
import { InboxRow } from '@/features/inbox/sections/inbox-row';

/**
 * The Inbox's list column: its head with the unread count, Refresh and the
 * filter, the search, a mail row per item with its age (one minute tick for
 * the list), the done ones of this visit under Show done, and Snoozed with
 * when each comes back. Rows checked for a bulk action, or Select in the
 * head, swap the head for the selection's bar; X checks the item on the deck. It reads the Inbox itself because it draws it; the
 * reading pane reads the same cache.
 */
export function InboxList() {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(60_000);
  const listing = useInboxListing(now);
  const { inbox, search, open, done } = listing;
  const read = useInboxRead();
  const marks = useInboxMarks();
  const reload = useRefreshInbox();
  const [pullsShown, setPullsShown] = useInboxPullsShown();
  const [alerts, setAlerts] = useAlertSwitch();
  const selection = useMultiSelection(open.map((item) => item.key));
  const picked = open.filter((item) => selection.has(item.key));
  // Select (the head's button) shows every row's checkbox before anything is
  // checked; checking a row does as much on its own.
  const [selectMode, setSelectMode] = useState(false);
  const selecting = selectMode || selection.any;
  const leaveSelecting = () => {
    selection.clear();
    setSelectMode(false);
  };
  const onPicked = (action: InboxMarkActionName) => {
    marks.apply(action, picked);
    leaveSelecting();
  };
  // On a phone nothing is in the reading pane until an item is opened.
  const phone = useIsMobile();
  const current = phone && search.item === null ? null : listing.current;
  useInboxSelectKeys({
    // X checks the item on the deck, or unchecks it, as a mail client does.
    onToggle: current ? () => selection.toggle(current.key, !selection.has(current.key)) : null,
    onLeave: selecting ? leaveSelecting : null,
  });
  const unread = inbox.open.filter((item) => !read.has(item.key) && item.key !== current?.key);
  const projectName = (id: string) => inbox.projects.find((project) => project.id === id)?.name;
  const counts = facetCounts(inbox.open, search.filter);
  const projectOptions = [
    { value: ALL_PROJECTS, label: t('inbox.project.all'), count: counts.all },
    ...inbox.projects
      .filter((project) => counts.projects.has(project.id))
      .map((project) => ({
        value: project.id,
        label: project.name,
        count: counts.projects.get(project.id) ?? 0,
      })),
    ...(counts.projects.has(NO_PROJECT)
      ? [
          {
            value: NO_PROJECT,
            label: t('inbox.project.none'),
            count: counts.projects.get(NO_PROJECT) ?? 0,
          },
        ]
      : []),
  ];
  const chips = [
    ...(search.filter.type !== 'all'
      ? [
          {
            key: 'type',
            label: t('inbox.filter.typeChip', { value: t(`inbox.type.${search.filter.type}`) }),
            onClear: () => search.setType('all'),
          },
        ]
      : []),
    ...(search.filter.project !== null
      ? [
          {
            key: 'project',
            label: t('inbox.filter.projectChip', {
              value:
                search.filter.project === NO_PROJECT
                  ? t('inbox.project.none')
                  : (projectName(search.filter.project) ?? ''),
            }),
            onClear: () => search.setProject(null),
          },
        ]
      : []),
  ];
  const until = dateFormatter(locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  const rows = [
    ...open.map((item) => ({ item, done: false })),
    ...done.map((item) => ({ item, done: true })),
  ];

  return (
    <>
      {selecting ? (
        <InboxSelectionBar
          count={picked.length}
          all={selection.all}
          low={picked.length > 0 && picked.every((item) => item.low)}
          onToggleAll={selection.toggleAll}
          onAction={onPicked}
          onClear={leaveSelecting}
        />
      ) : (
        <InboxListHead
          title={t('inbox.title')}
          count={unread.length ? t('inbox.list.unread', { count: unread.length }) : undefined}
        >
          {open.length ? (
            <IconButton
              size="sm"
              variant="quiet"
              aria-label={t('inbox.selection.start')}
              title={t('inbox.selection.start')}
              onClick={() => setSelectMode(true)}
            >
              <ListChecks />
            </IconButton>
          ) : null}
          <IconButton
            size="sm"
            variant="quiet"
            aria-label={t('inbox.list.refresh')}
            title={t('inbox.list.refresh')}
            aria-busy={reload.refreshing || undefined}
            onClick={reload.refresh}
          >
            <RotateCwIcon className={reload.refreshing ? 'motion-safe:animate-spin' : undefined} />
          </IconButton>
          <InboxFilterMenu
            filter={search.filter}
            typeCounts={counts.types}
            projects={projectOptions}
            showDone={search.showDone}
            pullsShown={pullsShown}
            alerts={alerts}
            dirty={search.dirty}
            onTypeChange={search.setType}
            onProjectChange={search.setProject}
            onShowDoneChange={search.setShowDone}
            onPullsShownChange={setPullsShown}
            onAlertsChange={setAlerts}
            onClear={search.clear}
          />
        </InboxListHead>
      )}
      <div className="shrink-0 border-b border-border-subtle pt-2.5 pb-0.5">
        <SidebarSearchField
          value={search.query}
          onChange={search.setQuery}
          label={t('inbox.list.search')}
          clearLabel={t('inbox.list.clearSearch')}
        />
        {chips.length ? <InboxFilterChips chips={chips} /> : null}
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-4">
        {inbox.error ? (
          <ErrorAlert error={inbox.error} fallback={t('inbox.list.failed')} className="mx-3 mt-2" />
        ) : null}
        {marks.error ? (
          <ErrorAlert
            error={marks.error}
            fallback={t('inbox.list.markFailed')}
            onDismiss={marks.dismiss}
            className="mx-3 mt-2"
          />
        ) : null}

        {rows.length === 0 ? (
          <SidebarEmptyRow className="mt-5 ml-3.5">
            {(search.dirty || search.query) && inbox.open.length > 0
              ? t('inbox.list.noneMatching')
              : t('inbox.list.empty')}
          </SidebarEmptyRow>
        ) : (
          <InboxRows>
            {rows.map(({ item, done: isDone }) => {
              const copy = inboxCopy(item, t);
              const active = !isDone && item.key === current?.key;
              return (
                <InboxRow
                  key={item.key}
                  item={item}
                  sender={copy.sender}
                  title={copy.short}
                  preview={copy.body}
                  meta={item.low && !isDone ? t('inbox.list.low') : formatAge(item.since, now, t)}
                  unread={!isDone && !active && !read.has(item.key)}
                  active={active}
                  done={isDone}
                  marks={marks}
                  selected={!isDone && selection.has(item.key)}
                  selecting={selecting}
                  onSelect={(on, range) => selection.toggle(item.key, on, range)}
                />
              );
            })}
          </InboxRows>
        )}

        {inbox.snoozed.length ? (
          <div className="px-2.5">
            <SidebarListHead
              label={t('inbox.list.snoozed')}
              count={inbox.snoozed.length}
              className="mt-4"
            />
            <InboxRows>
              {inbox.snoozed.map(({ item, until: back }) => (
                <InboxSnoozedRow
                  key={item.key}
                  title={inboxCopy(item, t).short}
                  until={t('inbox.list.back', { when: until.format(back) })}
                  action={
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => marks.apply('bringBack', item)}
                    >
                      {t('inbox.list.bringBack')}
                    </Button>
                  }
                />
              ))}
            </InboxRows>
          </div>
        ) : null}
      </div>
    </>
  );
}
