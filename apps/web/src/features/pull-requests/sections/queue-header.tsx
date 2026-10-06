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
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQueueSearch } from '../hooks/use-queue-search';
import { useReviewNextShortcut } from '../hooks/use-review-next-shortcut';
import { filterQueue, inRepository } from '../lib/queue-filter';
import { formatWait } from '../lib/view';

/**
 * The queue's display header: what can merge, what conflicts and the oldest
 * wait in the scope on screen, and its one action, Review next (`N`), which
 * opens the longest-waiting pull request the filters leave.
 */
export function QueueHeader() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { scope, lane, repo } = useQueueSearch();
  const { data: queue } = usePullRequestQueue(scope);
  const rows = inRepository(queue?.items ?? [], repo);
  const next = filterQueue(rows, lane, '')[0];
  const oldest = rows.reduce((max, row) => Math.max(max, row.waitingSeconds), 0);
  const reviewNext = next
    ? () =>
        navigate({
          to: '/pulls/$installationId/$githubRepoId/$number',
          params: {
            installationId: next.installationId,
            githubRepoId: String(next.githubRepoId),
            number: String(next.number),
          },
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
