import { SegmentedControl, SegmentedControlItem } from '@oppenheimer/design-system-web';
import type { PullRequestScope } from '@oppenheimer/frontend-consumer';
import { usePullRequestQueue } from '@oppenheimer/frontend-consumer/react';
import { PULL_REQUEST_SCOPES } from '@oppenheimer/shared/schemas/pull-request';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { FigurePlaceholder } from '../components/figure-placeholder';
import { useQueueSearch } from '../hooks/use-queue-search';

/**
 * Whose pull requests: mine, review requests, watching, each with its count,
 * and what the scope means. Which repositories are watched is set in
 * Settings, which Watching links to. A count not answered yet keeps its
 * place, so the tabs do not widen when it lands.
 */
export function QueueScopes() {
  const { t } = useTranslation();
  const { scope, setScope } = useQueueSearch();
  const { data: scopes } = usePullRequestQueue(scope, { select: (queue) => queue.scopes });

  return (
    <div className="flex flex-col gap-2.5">
      <SegmentedControl
        size="lg"
        value={scope}
        onValueChange={(value) => setScope(value as PullRequestScope)}
        aria-label={t('pullRequests.queue.scopesLabel')}
        className="self-start"
      >
        {PULL_REQUEST_SCOPES.map((value) => (
          <SegmentedControlItem
            key={value}
            value={value}
            count={scopes ? scopes[value] : <FigurePlaceholder className="w-1.5" />}
          >
            {t(`pullRequests.queue.scopes.${value}`)}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      <p className="m-0 text-sm text-fg-muted">
        {t(`pullRequests.queue.scopeHint.${scope}`)}
        {scope === 'watching' ? (
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
