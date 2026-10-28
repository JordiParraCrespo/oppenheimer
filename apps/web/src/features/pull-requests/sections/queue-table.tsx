import {
  Button,
  ChipSelect,
  EmptyState,
  FacetSelect,
  PullRequestTable,
  PullRequestTableHead,
  RunsListFoot,
} from '@oppenheimer/design-system-web';
import { GitBranch, GitPullRequest, Settings } from '@oppenheimer/design-system-web/icons';
import type { PullRequestLane } from '@oppenheimer/frontend-consumer';
import { useSuspensePullRequestQueue } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { PULL_REQUEST_LANES } from '@oppenheimer/shared/schemas/pull-request';
import { Link } from '@tanstack/react-router';
import { useDeferredValue, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QueueSearchField } from '../components/queue-search-field';
import { useOpenPullRequest } from '../hooks/use-open-pull-request';
import { useQueueKeys } from '../hooks/use-queue-keys';
import { useQueueSearch } from '../hooks/use-queue-search';
import { useReadNotices } from '../hooks/use-read-notices';
import { facetCounts, filterQueue, QUEUE_PAGE_SIZE } from '../lib/queue-filter';
import {
  needsWatchedRepositories,
  QUEUE_CHECKS,
  QUEUE_WAITS,
  type QueueChecks,
  type QueueWait,
} from '../lib/queue-search';
import { QueueRow } from './queue-row';

/**
 * The queue's table: the search, the repository and the Difficulty, Checks
 * and Waiting facets over the rows of the scope, in the API's order (the
 * deepest lane first, then the longest wait), a page at a time. Each facet
 * counts what picking an option would leave. The settled search is this
 * section's; the half-typed one is the field's. `j` / `k` pick a row, Enter
 * opens it, `/` goes to the search.
 *
 * Read under Suspense, in the screen's `QueryState`. The scope is read
 * deferred: a new scope renders in the background and the rows on screen
 * stay until it answers. A refetch that fails keeps the rows and says so
 * above them.
 */
export function QueueTable() {
  const { t } = useTranslation();
  const openPull = useOpenPullRequest();
  const { scope, filters, setRepo, setLane, setChecks, setWait } = useQueueSearch();
  const settled = useDeferredValue(scope);
  const { data, error } = useSuspensePullRequestQueue(settled);
  useReadNotices(data.unreadable);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const narrowed = { ...filters, query };
  const rows = filterQueue(data.items, narrowed);
  const pages = Math.max(1, Math.ceil(rows.length / QUEUE_PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * QUEUE_PAGE_SIZE, (current + 1) * QUEUE_PAGE_SIZE);
  const narrow = (apply: () => void) => {
    apply();
    setPage(0);
    setPicked(null);
  };
  useQueueKeys({
    onMove: (step) =>
      setPicked((at) =>
        shown.length ? Math.min(Math.max((at ?? -1) + step, 0), shown.length - 1) : null,
      ),
    onOpen: () => {
      const pull = picked === null ? undefined : shown[picked];
      if (pull) openPull(pull.address, 'description');
    },
    onSearch: () => search.current?.focus(),
    onRelease: () => setPicked(null),
  });

  if (!data.items.length) {
    const watching = needsWatchedRepositories(settled);
    return (
      <>
        <ErrorAlert error={error} fallback={t('pullRequests.queue.loadFailed')} />
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
            {watching ? (
              <EmptyState.Content>
                <Button
                  variant="secondary"
                  nativeButton={false}
                  render={<Link to="/settings/repositories" />}
                >
                  <Settings />
                  {t('pullRequests.queue.configureWatched')}
                </Button>
              </EmptyState.Content>
            ) : null}
          </EmptyState>
        </div>
      </>
    );
  }
  const repos = facetCounts(data.items, narrowed, 'repo');
  const lanes = facetCounts(data.items, narrowed, 'lane');
  const checks = facetCounts(data.items, narrowed, 'checks');
  const waits = facetCounts(data.items, narrowed, 'wait');
  const names = [...new Set(data.items.map((row) => row.repository))].sort();
  return (
    <>
      <ErrorAlert error={error} fallback={t('pullRequests.queue.loadFailed')} />
      <PullRequestTable>
        <div className="flex flex-wrap items-center gap-2 px-1.5 pt-1.5 pb-2">
          <QueueSearchField
            label={t('pullRequests.queue.search')}
            inputRef={search}
            onChange={(next) => narrow(() => setQuery(next))}
          />
          <ChipSelect
            aria-label={t('pullRequests.queue.repository')}
            icon={<GitBranch />}
            value={filters.repo ?? 'all'}
            onValueChange={(next) => narrow(() => setRepo(next === 'all' ? undefined : next))}
            options={[
              {
                value: 'all',
                label: t('pullRequests.queue.allRepositories'),
                count: repos.all ?? 0,
              },
              ...names.map((name) => ({
                value: name,
                label: name,
                mono: true,
                count: repos[name] ?? 0,
              })),
            ]}
            searchPlaceholder={t('pullRequests.watch.search')}
            emptyText={t('pullRequests.queue.noRepository')}
          />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <FacetSelect
              label={t('pullRequests.queue.difficulty')}
              value={filters.lane ?? 'all'}
              onValueChange={(next) =>
                narrow(() => setLane(next === 'all' ? undefined : (next as PullRequestLane)))
              }
              options={[
                { value: 'all', label: t('pullRequests.queue.all'), count: lanes.all ?? 0 },
                ...PULL_REQUEST_LANES.map((value) => ({
                  value,
                  label: t(`pullRequests.lanes.${value}`),
                  count: lanes[value] ?? 0,
                })),
              ]}
            />
            <FacetSelect
              label={t('pullRequests.queue.columns.checks')}
              value={filters.checks ?? 'all'}
              onValueChange={(next) =>
                narrow(() => setChecks(next === 'all' ? undefined : (next as QueueChecks)))
              }
              options={[
                { value: 'all', label: t('pullRequests.queue.any'), count: checks.all ?? 0 },
                ...QUEUE_CHECKS.map((value) => ({
                  value,
                  label: t(`pullRequests.checks.${value}`),
                  count: checks[value] ?? 0,
                })),
              ]}
            />
            <FacetSelect
              label={t('pullRequests.queue.columns.waiting')}
              value={filters.wait ?? 'all'}
              onValueChange={(next) =>
                narrow(() => setWait(next === 'all' ? undefined : (next as QueueWait)))
              }
              options={[
                {
                  value: 'all',
                  label: t('pullRequests.queue.anyTime'),
                  count: waits.all ?? 0,
                },
                ...QUEUE_WAITS.map((value) => ({
                  value,
                  label: t(`pullRequests.queue.waits.${value}`),
                  count: waits[value] ?? 0,
                })),
              ]}
            />
          </div>
        </div>
        <PullRequestTableHead
          labels={{
            lane: t('pullRequests.queue.columns.lane'),
            title: t('pullRequests.queue.columns.title'),
            size: t('pullRequests.queue.columns.size'),
            checks: t('pullRequests.queue.columns.checks'),
            conflicts: t('pullRequests.queue.columns.conflicts'),
            waiting: t('pullRequests.queue.columns.waiting'),
          }}
        />
        {shown.map((pull, index) => (
          <QueueRow
            key={`${pull.installationId}:${pull.githubRepoId}:${pull.number}`}
            pull={pull}
            selected={index === picked}
          />
        ))}
        {rows.length === 0 ? (
          <p className="m-0 px-3 py-3.5 text-sm text-fg-muted">
            {query.trim()
              ? t('pullRequests.queue.noMatch', { query: query.trim() })
              : t('pullRequests.queue.noFilterMatch')}
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
          previousLabel={t('pullRequests.queue.previousPage')}
          nextLabel={t('pullRequests.queue.nextPage')}
        />
      </PullRequestTable>
    </>
  );
}
