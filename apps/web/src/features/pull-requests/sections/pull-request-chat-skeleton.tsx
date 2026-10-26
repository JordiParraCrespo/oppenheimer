import { EmptyState, Skeleton } from '@oppenheimer/design-system-web';
import { SquareTerminal } from '@oppenheimer/design-system-web/icons';
import type { PullRequestAddress } from '@oppenheimer/frontend-consumer';
import { useReviewSessions } from '@oppenheimer/frontend-consumer/react';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { latestReview } from '../lib/review-session';

/**
 * The Chat tab before it answers, in the shape it will take: the review
 * session's terminal under its bar when the review sessions already read (the
 * sidebar's For review) hold one for this pull request, else the panel that
 * starts one, its title written. Guessing the terminal for a pull request
 * with no session would flash a pane that is not coming.
 */
export function PullRequestChatSkeleton({ address }: { address: PullRequestAddress }) {
  const { t } = useTranslation();
  const { data: sessions = [] } = useReviewSessions();
  const status = <LoadingStatus />;

  if (latestReview(sessions, address))
    return (
      <div aria-busy className="flex min-h-0 flex-1 flex-col bg-term-bg">
        {status}
        <div
          aria-hidden
          className="flex h-10 shrink-0 items-center gap-2.5 border-b border-term-border pr-3 pl-4"
        >
          <Skeleton shape="sm" className="h-2.5 w-32" />
          <Skeleton shape="sm" className="h-2.5 w-48 opacity-60" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col p-3.5">
          <Skeleton shape="none" className="min-h-0 w-full flex-1 opacity-40" />
        </div>
      </div>
    );

  return (
    <div aria-busy className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
      {status}
      <EmptyState className="my-auto">
        <EmptyState.Header>
          <EmptyState.Media variant="icon">
            <SquareTerminal />
          </EmptyState.Media>
          <EmptyState.Title>{t('pullRequests.reviewSession.title')}</EmptyState.Title>
          <EmptyState.Description>
            <Skeleton shape="sm" className="mx-auto my-1 h-3 w-72" />
          </EmptyState.Description>
        </EmptyState.Header>
        <EmptyState.Content className="flex-row justify-center">
          <Skeleton shape="pill" className="h-8 w-36" />
        </EmptyState.Content>
      </EmptyState>
    </div>
  );
}
