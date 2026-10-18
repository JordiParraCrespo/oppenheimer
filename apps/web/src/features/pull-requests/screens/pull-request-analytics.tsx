import { Skeleton } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { AnalyticsSkeleton } from '../components/analytics-skeleton';
import { useAnalyticsRange } from '../hooks/use-analytics-range';
import { AnalyticsHeader } from '../sections/analytics-header';
import { AnalyticsOverview } from '../sections/analytics-overview';

/**
 * Analytics, inside Pull requests for now (`product/next-steps/0.2-pull-requests.md`).
 * The overview reads the period under Suspense; this draws its placeholder —
 * the real header and range, the panels in outline — and a first failure.
 */
export function PullRequestAnalyticsScreen() {
  const { t } = useTranslation();
  const { range } = useAnalyticsRange();
  return (
    <QueryState>
      <QueryState.Pending>
        <AnalyticsHeader meta={<Skeleton shape="sm" className="h-2.5 w-80" />} />
        <AnalyticsSkeleton rangeWord={t(`pullRequests.analytics.rangeWord.${range}`)} />
      </QueryState.Pending>
      <QueryState.Error fallback={t('pullRequests.analytics.loadFailed')} />
      <QueryState.Data>
        <AnalyticsOverview />
      </QueryState.Data>
    </QueryState>
  );
}
