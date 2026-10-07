import {
  BarChart,
  ChartHero,
  ChartLegend,
  Panel,
  SegmentedControl,
  SegmentedControlItem,
} from '@oppenheimer/design-system-web';
import type { PullRequestAnalytics } from '@oppenheimer/frontend-consumer';
import { useLocale } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnalyticsDelta } from '../components/analytics-figure';
import { DAY_SERIES, dayBars } from '../lib/analytics-view';
import { deltaOf } from '../lib/view';

/** Created against merged, per day, with their headline figures; which series shows is this panel's. */
export function CreatedMergedPanel({ analytics }: { analytics: PullRequestAnalytics }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [mode, setMode] = useState('both');
  const series = DAY_SERIES(
    t('pullRequests.analytics.created'),
    t('pullRequests.analytics.merged'),
  );
  const shown = mode === 'both' ? series : series.filter((s) => s.key === mode);

  return (
    <Panel>
      <div className="flex flex-wrap items-start gap-7">
        <ChartHero
          tone="chart-1"
          label={t('pullRequests.analytics.created')}
          value={analytics.created.value}
          delta={
            <AnalyticsDelta
              delta={deltaOf(analytics.created, true)}
              previous={t('pullRequests.analytics.from', { value: analytics.created.previous })}
            />
          }
        />
        <ChartHero
          tone="chart-2"
          label={t('pullRequests.analytics.merged')}
          value={analytics.merged.value}
          delta={
            <AnalyticsDelta
              delta={deltaOf(analytics.merged, true)}
              previous={t('pullRequests.analytics.from', { value: analytics.merged.previous })}
            />
          }
        />
        <span className="flex-1" />
        <SegmentedControl
          size="md"
          value={mode}
          onValueChange={setMode}
          aria-label={t('pullRequests.analytics.series')}
        >
          <SegmentedControlItem value="both">
            {t('pullRequests.analytics.both')}
          </SegmentedControlItem>
          <SegmentedControlItem value="created">
            {t('pullRequests.analytics.created')}
          </SegmentedControlItem>
          <SegmentedControlItem value="merged">
            {t('pullRequests.analytics.merged')}
          </SegmentedControlItem>
        </SegmentedControl>
      </div>
      <BarChart
        series={shown}
        data={dayBars(analytics, locale, (date) => t('pullRequests.analytics.weekOf', { date }))}
        aria-label={t('pullRequests.analytics.perDay')}
        readout={t(
          analytics.bucket === 'week'
            ? 'pullRequests.analytics.hoverWeek'
            : 'pullRequests.analytics.hover',
        )}
      />
      <ChartLegend series={shown} />
    </Panel>
  );
}
