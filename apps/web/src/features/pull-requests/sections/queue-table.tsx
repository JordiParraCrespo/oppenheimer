import {
  EmptyState,
  PillTab,
  PillTabs,
  PullRequestTable,
  PullRequestTableHead,
  RunsListFoot,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { GitPullRequest } from '@oppenheimer/design-system-web/icons';
import type { PullRequestLane } from '@oppenheimer/frontend-consumer';
import { usePullRequestQueue } from '@oppenheimer/frontend-consumer/react';
import { QueryState } from '@oppenheimer/frontend-web';
import { PULL_REQUEST_LANES } from '@oppenheimer/shared/schemas/pull-request';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QueueSearchField } from '../components/queue-search-field';
import { ReadNotices } from '../components/read-notices';
import { useQueueSearch } from '../hooks/use-queue-search';
import { filterQueue, inRepository, QUEUE_PAGE_SIZE } from '../lib/queue-filter';
import { QueueRow } from './queue-row';

/**
 * The queue's table: the search and the lane pills over the rows of the scope,
 * longest wait first, a page at a time. The settled search is this section's;
 * the half-typed one is the field's.
 */
export function QueueTable() {
  const { t } = useTranslation();
  const { scope, lane, repo, setLane } = useQueueSearch();
  const queue = usePullRequestQueue(scope);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  return (
    <QueryState
      query={queue}
      pending={<Skeleton className="h-80 w-full" />}
      errorFallback={t('pullRequests.queue.loadFailed')}
    >
      {(data) => {
        const scoped = inRepository(data.items, repo);
        const count = (value: PullRequestLane) => scoped.filter((row) => row.lane === value).length;
        const rows = filterQueue(scoped, lane, query);
        const pages = Math.max(1, Math.ceil(rows.length / QUEUE_PAGE_SIZE));
        const current = Math.min(page, pages - 1);
        const shown = rows.slice(current * QUEUE_PAGE_SIZE, (current + 1) * QUEUE_PAGE_SIZE);
        const notices = (
          <ReadNotices unreadable={data.unreadable} checksRefused={data.checksRefused} />
        );
        if (!data.items.length) {
          const watching = scope === 'watching';
          return (
            <div className="flex flex-col gap-3">
              {notices}
              <div className="rounded-xl bg-card py-6">
                <EmptyState>
                  <EmptyState.Header>
                    <EmptyState.Media variant="icon">
                      <GitPullRequest />
                    </EmptyState.Media>
                    <EmptyState.Title>
                      {t(
                        watching
                          ? 'pullRequests.queue.emptyWatchingTitle'
                          : 'pullRequests.queue.emptyTitle',
                      )}
                    </EmptyState.Title>
                    <EmptyState.Description>
                      {t(
                        watching
                          ? 'pullRequests.queue.emptyWatchingHint'
                          : 'pullRequests.queue.emptyHint',
                      )}
                    </EmptyState.Description>
                  </EmptyState.Header>
                </EmptyState>
              </div>
            </div>
          );
        }
        return (
          <div className="flex flex-col gap-3">
            {notices}
            <PullRequestTable>
              <div className="flex flex-wrap items-center gap-2 px-1.5 pt-1.5 pb-2">
                <QueueSearchField
                  label={t('pullRequests.queue.search')}
                  onChange={(next) => {
                    setQuery(next);
                    setPage(0);
                  }}
                />
                <span className="flex-1" />
                <PillTabs
                  size="sm"
                  value={lane ?? 'all'}
                  onValueChange={(next) => {
                    setLane(next === 'all' ? undefined : (next as PullRequestLane));
                    setPage(0);
                  }}
                  aria-label={t('pullRequests.queue.laneLabel')}
                >
                  <PillTab value="all" count={scoped.length}>
                    {t('pullRequests.queue.all')}
                  </PillTab>
                  {PULL_REQUEST_LANES.map((value) => (
                    <PillTab key={value} value={value} count={count(value)}>
                      {t(`pullRequests.lanes.${value}`)}
                    </PillTab>
                  ))}
                </PillTabs>
              </div>
              <PullRequestTableHead />
              {shown.map((pull) => (
                <QueueRow
                  key={`${pull.installationId}:${pull.githubRepoId}:${pull.number}`}
                  pull={pull}
                />
              ))}
              {rows.length === 0 ? (
                <p className="m-0 px-3 py-3.5 text-sm text-fg-muted">
                  {t('pullRequests.queue.noMatch', { query: query.trim() })}
                </p>
              ) : null}
              <RunsListFoot
                range={t('pullRequests.queue.range', {
                  first: rows.length ? current * QUEUE_PAGE_SIZE + 1 : 0,
                  last: Math.min(rows.length, (current + 1) * QUEUE_PAGE_SIZE),
                  total: rows.length,
                })}
                onPrevious={current > 0 ? () => setPage(current - 1) : undefined}
                onNext={current < pages - 1 ? () => setPage(current + 1) : undefined}
              />
            </PullRequestTable>
          </div>
        );
      }}
    </QueryState>
  );
}
