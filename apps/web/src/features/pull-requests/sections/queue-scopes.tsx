import { SegmentedControl, SegmentedControlItem } from '@oppenheimer/design-system-web';
import type { PullRequestScope } from '@oppenheimer/frontend-consumer';
import { usePullRequestQueue } from '@oppenheimer/frontend-consumer/react';
import { PULL_REQUEST_SCOPES } from '@oppenheimer/shared/schemas/pull-request';
import { useTranslation } from 'react-i18next';
import { useQueueSearch } from '../hooks/use-queue-search';
import { WatchedRepositories } from './watched-repositories';

/** Whose pull requests: mine, review requests, watching, each with its count, and what the scope means. */
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
          <SegmentedControlItem key={value} value={value} count={scopes?.[value]}>
            {t(`pullRequests.queue.scopes.${value}`)}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      <p className="m-0 text-sm text-fg-muted">{t(`pullRequests.queue.scopeHint.${scope}`)}</p>
      {scope === 'watching' ? <WatchedRepositories /> : null}
    </div>
  );
}
