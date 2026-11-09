import {
  Button,
  Kbd,
  PageHeader,
  PageHeaderMeta,
  PageHeaderRow,
  PageHeaderSep,
  PageHeaderStat,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { ArrowRight } from '@oppenheimer/design-system-web/icons';
import { usePullRequestQueue } from '@oppenheimer/frontend-consumer/react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQueueSearch } from '../hooks/use-queue-search';
import { useReviewNextShortcut } from '../hooks/use-review-next-shortcut';
import { filterQueue } from '../lib/queue-filter';
import { deckKey } from '../lib/review-deck';
import { formatWait } from '../lib/view';

/**
 * The queue's display header: what can merge, what conflicts and the oldest
 * wait in the scope on screen, and its one action, Review next (`N`), which
 * opens the review deck on the first pull request the filters leave: the
 * deepest lane, the longest wait. Until the queue answers, each figure is a placeholder rather
 * than a zero.
 */
export function QueueHeader() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { scope, filters } = useQueueSearch();
  const { data: queue } = usePullRequestQueue(scope);
  const rows = filterQueue(queue?.items ?? [], { repo: filters.repo });
  const next = filterQueue(rows, filters)[0];
  const oldest = rows.reduce((max, row) => Math.max(max, row.waitingSeconds), 0);
  const reviewNext = next
    ? () =>
        navigate({
          to: '/pulls/review',
          search: { ...filters, scope: scope === 'all' ? undefined : scope, at: deckKey(next) },
        })
    : undefined;
  useReviewNextShortcut(reviewNext);

  return (
    <PageHeader>
      <PageHeaderRow
        size="display"
        title={t('pullRequests.queue.title')}
        actions={
          <Button onClick={reviewNext} disabled={!reviewNext}>
            <ArrowRight />
            {t('pullRequests.queue.reviewNext')}
            <Kbd className="ml-1">N</Kbd>
          </Button>
        }
      />
      <PageHeaderMeta indent={false}>
        <PageHeaderStat
          value={
            queue ? (
              rows.filter((row) => row.canMerge).length
            ) : (
              <Skeleton shape="sm" className="inline-block h-2.5 w-2 align-[-0.05em]" />
            )
          }
        >
          {t('pullRequests.queue.ready')}
        </PageHeaderStat>
        <PageHeaderSep />
        <PageHeaderStat
          value={
            queue ? (
              rows.filter((row) => row.hasConflicts).length
            ) : (
              <Skeleton shape="sm" className="inline-block h-2.5 w-2 align-[-0.05em]" />
            )
          }
        >
          {t('pullRequests.queue.conflicts')}
        </PageHeaderStat>
        <PageHeaderSep />
        <span>
          {t('pullRequests.queue.oldest')}{' '}
          <span className="figures text-fg">
            {!queue ? (
              <Skeleton shape="sm" className="inline-block h-2.5 w-8 align-[-0.05em]" />
            ) : rows.length ? (
              formatWait(oldest)
            ) : (
              '—'
            )}
          </span>
        </span>
      </PageHeaderMeta>
    </PageHeader>
  );
}
