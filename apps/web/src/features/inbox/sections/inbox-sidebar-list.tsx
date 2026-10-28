import {
  Button,
  InboxList,
  InboxSnoozedRow,
  SidebarEmptyRow,
  SidebarListHead,
  useNow,
} from '@oppenheimer/design-system-web';
import { useSuspenseInbox } from '@oppenheimer/frontend-consumer/react';
import { dateFormatter, ErrorAlert, formatAge, useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { InboxFilterChips } from '@/features/inbox/components/inbox-filter-chips';
import { InboxFilterMenu } from '@/features/inbox/components/inbox-filter-menu';
import { useInboxMarks } from '@/features/inbox/hooks/use-inbox-marks';
import { useInboxSearch } from '@/features/inbox/hooks/use-inbox-search';
import { useInboxVisit } from '@/features/inbox/hooks/use-inbox-visit';
import { inboxCopy, inboxFrom } from '@/features/inbox/lib/inbox-copy';
import { currentItem } from '@/features/inbox/lib/inbox-current';
import { facetCounts, listedItems } from '@/features/inbox/lib/inbox-filter';
import { ALL_PROJECTS, NO_PROJECT } from '@/features/inbox/lib/inbox-search';
import { InboxRow } from '@/features/inbox/sections/inbox-row';

/**
 * The Inbox's list in the sidebar (`29-inbox.md` §5): Needs you with its
 * count and the filter, a row per item with its age (one minute tick for the
 * list), the done ones of this visit under Show done, and Snoozed with when
 * each comes back. It reads the Inbox itself because it draws it; the pane
 * reads the same cache.
 */
export function InboxSidebarList() {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(60_000);
  const inbox = useSuspenseInbox(now);
  const visit = useInboxVisit();
  const search = useInboxSearch();
  const marks = useInboxMarks();

  const { open, done } = listedItems(inbox, visit, search.filter, search.showDone);
  const current = currentItem(open, search.item, { answered: inbox.answered, done: visit.done });
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
    <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto pb-5">
      <SidebarListHead label={t('inbox.list.head')} count={inbox.open.length}>
        <InboxFilterMenu
          filter={search.filter}
          typeCounts={counts.types}
          projects={projectOptions}
          showDone={search.showDone}
          dirty={search.dirty}
          onTypeChange={search.setType}
          onProjectChange={search.setProject}
          onShowDoneChange={search.setShowDone}
          onClear={search.clear}
        />
      </SidebarListHead>
      {chips.length ? <InboxFilterChips chips={chips} /> : null}

      {inbox.error ? (
        <ErrorAlert error={inbox.error} fallback={t('inbox.list.failed')} className="mx-3 mb-2" />
      ) : null}
      {marks.error ? (
        <ErrorAlert
          error={marks.error}
          fallback={t('inbox.list.markFailed')}
          onDismiss={marks.dismiss}
          className="mx-3 mb-2"
        />
      ) : null}

      {rows.length === 0 ? (
        <SidebarEmptyRow className="ml-3.5">
          {search.dirty && inbox.open.length > 0
            ? t('inbox.list.noneMatching')
            : t('inbox.list.empty')}
        </SidebarEmptyRow>
      ) : (
        <InboxList className="px-2">
          {rows.map(({ item, done: isDone }) => {
            const copy = inboxCopy(item, t);
            return (
              <InboxRow
                key={item.key}
                item={item}
                title={copy.short}
                from={inboxFrom(item, copy.source, projectName)}
                meta={item.low && !isDone ? t('inbox.list.low') : formatAge(item.since, now, t)}
                active={!isDone && item.key === current?.key}
                done={isDone}
                marks={marks}
              />
            );
          })}
        </InboxList>
      )}

      {inbox.snoozed.length ? (
        <>
          <SidebarListHead
            label={t('inbox.list.snoozed')}
            count={inbox.snoozed.length}
            className="mt-4"
          />
          <InboxList className="px-2">
            {inbox.snoozed.map(({ item, until: back }) => (
              <InboxSnoozedRow
                key={item.key}
                title={inboxCopy(item, t).short}
                until={t('inbox.list.back', { when: until.format(back) })}
                action={
                  <Button size="xs" variant="secondary" onClick={() => marks.bringBack(item)}>
                    {t('inbox.list.bringBack')}
                  </Button>
                }
              />
            ))}
          </InboxList>
        </>
      ) : null}
    </div>
  );
}
