import { Button, EmptyState } from '@oppenheimer/design-system-web';
import { GitPullRequest, Settings } from '@oppenheimer/design-system-web/icons';
import type { PullRequestQueueName } from '@oppenheimer/frontend-consumer';
import { useWatchedRepositories } from '@oppenheimer/frontend-consumer/react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { needsWatchedRepositories } from '../lib/queue-search';

/**
 * A queue with no rows. It sends the reader to Settings only when nothing is
 * watched: watched repositories with no open pull request (the last one just
 * merged) are an empty queue, not a missing setup.
 */
export function QueueEmpty({ queue }: { queue: PullRequestQueueName }) {
  const { t } = useTranslation();
  const { data: watched } = useWatchedRepositories({
    select: (rows) => rows.filter((row) => row.watching).length,
  });
  const unwatched = needsWatchedRepositories(queue) && watched === 0;

  return (
    <div className="rounded-xl bg-card py-6">
      <EmptyState>
        <EmptyState.Header>
          <EmptyState.Media variant="icon">
            <GitPullRequest />
          </EmptyState.Media>
          <EmptyState.Title>
            {t(
              unwatched ? 'pullRequests.queue.emptyWatchingTitle' : 'pullRequests.queue.emptyTitle',
            )}
          </EmptyState.Title>
          <EmptyState.Description>
            {t(unwatched ? 'pullRequests.queue.emptyWatchingHint' : 'pullRequests.queue.emptyHint')}
          </EmptyState.Description>
        </EmptyState.Header>
        {unwatched ? (
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
  );
}
