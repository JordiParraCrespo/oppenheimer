import {
  Button,
  Kbd,
  PageHeader,
  PageHeaderMeta,
  PageHeaderRow,
  PageHeaderSep,
  PageHeaderStat,
} from '@oppenheimer/design-system-web';
import { ArrowRight } from '@oppenheimer/design-system-web/icons';
import { usePullRequestQueue } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { useOpenPullRequest } from '../hooks/use-open-pull-request';
import { useQueueSearch } from '../hooks/use-queue-search';
import { useReviewNextShortcut } from '../hooks/use-review-next-shortcut';
import { filterQueue } from '../lib/queue-filter';
import { formatWait } from '../lib/view';

/**
 * The queue's display header: what can merge, what conflicts and the oldest
 * wait in the scope on screen, and its one action, Review next (`N`), which
 * opens the first pull request the filters leave: the deepest lane, the
 * longest wait.
 */
export function QueueHeader() {
  const { t } = useTranslation();
  const openPull = useOpenPullRequest();
  const { scope, filters } = useQueueSearch();
  const { data: queue } = usePullRequestQueue(scope);
  const rows = filterQueue(queue?.items ?? [], { repo: filters.repo });
  const next = filterQueue(rows, filters)[0];
  const oldest = rows.reduce((max, row) => Math.max(max, row.waitingSeconds), 0);
  const reviewNext = next ? () => openPull(next.address, 'description') : undefined;
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
        <PageHeaderStat value={rows.filter((row) => row.canMerge).length}>
          {t('pullRequests.queue.ready')}
        </PageHeaderStat>
        <PageHeaderSep />
        <PageHeaderStat value={rows.filter((row) => row.hasConflicts).length}>
          {t('pullRequests.queue.conflicts')}
        </PageHeaderStat>
        <PageHeaderSep />
        <span>
          {t('pullRequests.queue.oldest')}{' '}
          <span className="figures text-fg">{rows.length ? formatWait(oldest) : '—'}</span>
        </span>
      </PageHeaderMeta>
    </PageHeader>
  );
}
