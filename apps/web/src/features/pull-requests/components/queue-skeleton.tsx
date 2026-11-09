import {
  ChipSelect,
  FacetSelect,
  PullRequestRowSkeleton,
  PullRequestTable,
  PullRequestTableHead,
  RunsListFoot,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { GitBranch } from '@oppenheimer/design-system-web/icons';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { QueueSearchField } from './queue-search-field';

/** As many rows as a queue usually holds: enough to stand for it, not a full page to collapse. */
const ROWS = 4;
const noop = () => {};

/** What a facet or the repository chip is set to: the URL's, which this placeholder does not read. */
function current(width: string) {
  return (
    <span className="inline-flex h-4 items-center">
      <Skeleton shape="sm" className={`h-2.5 ${width}`} />
    </span>
  );
}

/**
 * The queue's table before its first answer, in the table's own card: the
 * filter row's real controls, inert, with the search's placeholder and each
 * facet's name written and a bar for what it is set to, the real column
 * heads, rows on the row's grid and the foot with its page buttons off, so
 * the table that replaces it grows by its rows and nothing else moves.
 */
export function QueueSkeleton() {
  const { t } = useTranslation();
  return (
    <PullRequestTable aria-busy>
      <LoadingStatus />
      <div inert className="flex flex-wrap items-center gap-2 px-1.5 pt-1.5 pb-2">
        <QueueSearchField label={t('pullRequests.queue.search')} onChange={noop} disabled />
        <ChipSelect
          aria-label={t('pullRequests.queue.repository')}
          icon={<GitBranch />}
          value={null}
          onValueChange={noop}
          options={[]}
          placeholder={current('w-24')}
          disabled
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <FacetSelect
            label={t('pullRequests.queue.difficulty')}
            value="all"
            onValueChange={noop}
            options={[{ value: 'all', label: current('w-6') }]}
          />
          <FacetSelect
            label={t('pullRequests.queue.columns.checks')}
            value="all"
            onValueChange={noop}
            options={[{ value: 'all', label: current('w-8') }]}
          />
          <FacetSelect
            label={t('pullRequests.queue.columns.waiting')}
            value="all"
            onValueChange={noop}
            options={[{ value: 'all', label: current('w-14') }]}
          />
        </div>
      </div>
      <PullRequestTableHead
        aria-hidden
        labels={{
          lane: t('pullRequests.queue.columns.lane'),
          title: t('pullRequests.queue.columns.title'),
          size: t('pullRequests.queue.columns.size'),
          checks: t('pullRequests.queue.columns.checks'),
          conflicts: t('pullRequests.queue.columns.conflicts'),
          waiting: t('pullRequests.queue.columns.waiting'),
        }}
      />
      {Array.from({ length: ROWS }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity but their place.
        <PullRequestRowSkeleton key={index} index={index} />
      ))}
      <RunsListFoot
        range={current('w-14')}
        previousLabel={t('pullRequests.queue.previousPage')}
        nextLabel={t('pullRequests.queue.nextPage')}
      />
    </PullRequestTable>
  );
}
