import { PageHeader, PageHeaderRow } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { ReviewDeckSkeleton } from '../components/review-deck-skeleton';
import { ReviewDeck } from '../sections/review-deck';

/**
 * Review: the queue walked one pull request at a time
 * (`product/next-steps/0.2-pull-requests.md`, "The review deck"). The deck
 * reads the queue under Suspense; this draws its placeholder and a first
 * failure.
 */
export function PullRequestReviewScreen() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader>
        <PageHeaderRow title={t('pullRequests.deck.title')} />
      </PageHeader>
      <QueryState>
        <QueryState.Pending>
          <ReviewDeckSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('pullRequests.queue.loadFailed')} />
        <QueryState.Data>
          <ReviewDeck />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
