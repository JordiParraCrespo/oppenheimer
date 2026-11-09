import { SegmentedControl, SegmentedControlItem, Skeleton } from '@oppenheimer/design-system-web';
import type { PullRequestQueueName } from '@oppenheimer/frontend-consumer';
import { PULL_REQUEST_QUEUES } from '@oppenheimer/shared/schemas/pull-request';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQueueScopeCounts } from '../hooks/use-queue-scope-counts';
import { useQueueSearch } from '../hooks/use-queue-search';
import { needsWatchedRepositories } from '../lib/queue-search';

/**
 * Whose pull requests: all of them first, then the three ways to narrow
 * them (mine, review requests, watching), each with its count, and what the
 * scope means. Which repositories are watched is set in
 * Settings, which Watching links to. Each count is what that tab's table
 * would show under the filters picked (`useQueueScopeCounts`). A count not
 * answered yet keeps its place, so the tabs do not widen when it lands.
 */
export function QueueScopes() {
  const { t } = useTranslation();
  const { scope, setScope } = useQueueSearch();
  const scopes = useQueueScopeCounts();

  return (
    <div className="flex flex-col gap-2.5">
      <SegmentedControl
        size="lg"
        value={scope}
        onValueChange={(value) => setScope(value as PullRequestQueueName)}
        aria-label={t('pullRequests.queue.scopesLabel')}
        className="self-start"
      >
        {PULL_REQUEST_QUEUES.map((value) => (
          <SegmentedControlItem
            key={value}
            value={value}
            count={
              scopes ? (
                scopes[value]
              ) : (
                <Skeleton shape="sm" className="inline-block h-2.5 w-1.5 align-[-0.05em]" />
              )
            }
          >
            {t(`pullRequests.queue.scopes.${value}`)}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      <p className="m-0 text-sm text-fg-muted">
        {t(`pullRequests.queue.scopeHint.${scope}`)}
        {needsWatchedRepositories(scope) ? (
          <>
            {' '}
            <Link to="/settings/repositories" className="text-link">
              {t('pullRequests.queue.configureWatched')}
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
