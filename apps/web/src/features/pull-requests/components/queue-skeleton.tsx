import {
  PullRequestRowSkeleton,
  PullRequestTable,
  PullRequestTableHead,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/** As many rows as a queue usually holds: enough to stand for it, not a full page to collapse. */
const ROWS = 4;

/**
 * The queue's table before its first answer, in the table's own card: the
 * filter row's controls at their sizes, the real column heads, rows on the
 * row's grid and the foot, so the table that replaces it grows by its rows
 * and nothing else moves.
 */
export function QueueSkeleton() {
  const { t } = useTranslation();
  return (
    <PullRequestTable aria-busy>
      <span role="status" className="sr-only">
        {t('common.loading')}
      </span>
      <div className="flex flex-wrap items-center gap-2 px-1.5 pt-1.5 pb-2">
        <Skeleton shape="pill" className="h-8.5 w-60" />
        <Skeleton shape="pill" className="h-8.5 w-40" />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Skeleton shape="pill" className="h-8.5 w-29" />
          <Skeleton shape="pill" className="h-8.5 w-29" />
          <Skeleton shape="pill" className="h-8.5 w-36" />
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
      <div aria-hidden className="flex h-10 items-center pl-3">
        <Skeleton shape="sm" className="h-2.5 w-14" />
      </div>
    </PullRequestTable>
  );
}
