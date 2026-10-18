import {
  PageHeader,
  PageHeaderMeta,
  PageHeaderRow,
  SegmentedControl,
  SegmentedControlItem,
} from '@oppenheimer/design-system-web';
import type { PullRequestAnalyticsRange } from '@oppenheimer/frontend-consumer';
import { PULL_REQUEST_ANALYTICS_RANGES } from '@oppenheimer/shared/schemas/pull-request';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnalyticsRange } from '../hooks/use-analytics-range';

/**
 * Analytics' title and its range, which only need the URL, so they are drawn
 * before the period answers and stay put while it loads; `meta` is the line
 * under them, the period's dates once there is one.
 */
export function AnalyticsHeader({ meta }: { meta: ReactNode }) {
  const { t } = useTranslation();
  const { range, setRange } = useAnalyticsRange();
  return (
    <PageHeader>
      <PageHeaderRow
        size="display"
        title={t('pullRequests.analytics.title', {
          range: t(`pullRequests.analytics.rangeWord.${range}`),
        })}
        actions={
          <SegmentedControl
            size="md"
            value={range}
            onValueChange={(next) => setRange(next as PullRequestAnalyticsRange)}
            aria-label={t('pullRequests.analytics.rangeLabel')}
          >
            {PULL_REQUEST_ANALYTICS_RANGES.map((value) => (
              <SegmentedControlItem key={value} value={value}>
                {t(`pullRequests.analytics.ranges.${value}`)}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        }
      />
      <PageHeaderMeta indent={false}>{meta}</PageHeaderMeta>
    </PageHeader>
  );
}
