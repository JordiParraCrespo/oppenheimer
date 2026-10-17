import { Skeleton } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { AnalyticsOverview } from '../sections/analytics-overview';

/**
 * Analytics, inside Pull requests for now (`product/next-steps/0.2-pull-requests.md`).
 * The overview reads the period under Suspense; this draws its placeholder and
 * a first failure.
 */
export function PullRequestAnalyticsScreen() {
  const { t } = useTranslation();
  return (
    <QueryState>
      <QueryState.Pending>
        <Skeleton className="h-96 w-full" />
      </QueryState.Pending>
      <QueryState.Error fallback={t('pullRequests.analytics.loadFailed')} />
      <QueryState.Data>
        <AnalyticsOverview />
      </QueryState.Data>
    </QueryState>
  );
}
