import {
  BarList,
  Callout,
  ChartRow,
  PageHeader,
  PageHeaderMeta,
  PageHeaderRow,
  Panel,
  PanelGrid,
  RingChart,
  SegmentedControl,
  SegmentedControlItem,
  Skeleton,
  StatCard,
} from '@oppenheimer/design-system-web';
import { Bot, User } from '@oppenheimer/design-system-web/icons';
import type { PullRequestAnalyticsRange } from '@oppenheimer/frontend-consumer';
import { usePullRequestAnalytics } from '@oppenheimer/frontend-consumer/react';
import { QueryState, useLocale } from '@oppenheimer/frontend-web';
import { PULL_REQUEST_ANALYTICS_RANGES } from '@oppenheimer/shared/schemas/pull-request';
import { useTranslation } from 'react-i18next';
import { AnalyticsDelta } from '../components/analytics-figure';
import { useAnalyticsRange } from '../hooks/use-analytics-range';
import { useReadNotices } from '../hooks/use-read-notices';
import { LANE_TONE, rangeLabel, shareOf } from '../lib/analytics-view';
import { deltaOf, formatHours } from '../lib/view';
import { CreatedMergedPanel } from './created-merged-panel';

/**
 * Analytics: the watched repositories' review period against the one before
 * it — created and merged per day, what you reviewed, the median waits for
 * agent sessions and for people, the lane mix and what holds open pull
 * requests now. Everything is computed live from GitHub on the API.
 */
export function AnalyticsOverview() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { range, setRange } = useAnalyticsRange();
  const analytics = usePullRequestAnalytics(range);
  useReadNotices(analytics.data?.unreadable);
  const rangeWord = t(`pullRequests.analytics.rangeWord.${range}`);

  return (
    <>
      <PageHeader>
        <PageHeaderRow
          size="display"
          title={t('pullRequests.analytics.title', { range: rangeWord })}
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
        <PageHeaderMeta indent={false}>
          {analytics.data ? (
            <span>
              <span className="figures text-fg">{rangeLabel(analytics.data, locale)}</span>{' '}
              {t('pullRequests.analytics.compared', {
                days: Math.round(
                  (new Date(analytics.data.to).getTime() -
                    new Date(analytics.data.from).getTime()) /
                    86_400_000,
                ),
              })}
            </span>
          ) : null}
        </PageHeaderMeta>
      </PageHeader>
      <QueryState
        query={analytics}
        pending={<Skeleton className="h-96 w-full" />}
        errorFallback={t('pullRequests.analytics.loadFailed')}
      >
        {(data) => {
          const mergedTotal = data.lanes.reduce((sum, lane) => sum + lane.value, 0);
          const waitingTotal = data.waiting.reduce((sum, row) => sum + row.value, 0);
          const from = (value: string) => t('pullRequests.analytics.from', { value });
          return (
            <>
              {data.complete ? null : (
                <Callout>{t('pullRequests.analytics.capped', { range: rangeWord })}</Callout>
              )}
              <CreatedMergedPanel analytics={data} />
              <div className="grid gap-3 md:grid-cols-3">
                <StatCard
                  label={t('pullRequests.analytics.reviewedByYou')}
                  value={data.reviewedByYou.value}
                  detail={
                    <AnalyticsDelta
                      delta={deltaOf(data.reviewedByYou, true)}
                      previous={from(String(data.reviewedByYou.previous))}
                    />
                  }
                />
                <StatCard
                  label={t('pullRequests.analytics.waitForReview')}
                  value={formatHours(data.waitForReview.value)}
                  detail={
                    <AnalyticsDelta
                      delta={deltaOf(data.waitForReview, false)}
                      previous={from(formatHours(data.waitForReview.previous))}
                    />
                  }
                />
                <StatCard
                  label={t('pullRequests.analytics.timeToMerge')}
                  value={formatHours(data.timeToMerge.value)}
                  detail={
                    <AnalyticsDelta
                      delta={deltaOf(data.timeToMerge, false)}
                      previous={from(formatHours(data.timeToMerge.previous))}
                    />
                  }
                />
              </div>
              <Panel
                title={t('pullRequests.analytics.waitTitle')}
                meta={t('pullRequests.analytics.vsPrevious', { range: rangeWord })}
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <StatCard
                    label={
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-pill bg-chart-1" />
                        {t('pullRequests.analytics.agents')}
                        <Bot className="ml-auto size-3.5 text-fg-subtle" aria-hidden />
                      </span>
                    }
                    value={formatHours(data.waitForReviewAgents.value)}
                    detail={
                      <AnalyticsDelta
                        delta={deltaOf(data.waitForReviewAgents, false)}
                        previous={from(formatHours(data.waitForReviewAgents.previous))}
                      />
                    }
                  />
                  <StatCard
                    label={
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-pill bg-chart-2" />
                        {t('pullRequests.analytics.people')}
                        <User className="ml-auto size-3.5 text-fg-subtle" aria-hidden />
                      </span>
                    }
                    value={formatHours(data.waitForReviewPeople.value)}
                    detail={
                      <AnalyticsDelta
                        delta={deltaOf(data.waitForReviewPeople, false)}
                        previous={from(formatHours(data.waitForReviewPeople.previous))}
                      />
                    }
                  />
                </div>
              </Panel>
              <PanelGrid>
                <Panel
                  title={t('pullRequests.analytics.laneMix')}
                  meta={t('pullRequests.analytics.vsPrevious', { range: rangeWord })}
                >
                  <RingChart
                    label={t('pullRequests.analytics.mergedWord')}
                    value={mergedTotal}
                    segments={data.lanes.map((lane) => ({
                      key: lane.lane,
                      label: t(`pullRequests.lanes.${lane.lane}`),
                      value: lane.value,
                      tone: LANE_TONE[lane.lane],
                    }))}
                  />
                  <div className="flex flex-col">
                    {data.lanes.map((lane) => (
                      <ChartRow
                        key={lane.lane}
                        tone={LANE_TONE[lane.lane]}
                        label={t(`pullRequests.lanes.${lane.lane}`)}
                        value={lane.value}
                        share={`${shareOf(lane.value, mergedTotal)}%`}
                        delta={
                          <AnalyticsDelta
                            delta={{
                              value: `${lane.value - lane.previous >= 0 ? '+' : '−'}${Math.abs(lane.value - lane.previous)}`,
                              tone: 'flat',
                            }}
                            previous=""
                          />
                        }
                      />
                    ))}
                  </div>
                </Panel>
                <Panel
                  title={t('pullRequests.analytics.waited')}
                  meta={
                    <span className="figures">
                      {t('pullRequests.analytics.waitedMeta', { n: waitingTotal })}
                    </span>
                  }
                >
                  {data.waiting.length ? (
                    <BarList
                      rows={data.waiting.map((row) => ({
                        key: row.reason,
                        label: t(`pullRequests.blocker.${row.reason}`),
                        value: row.value,
                        share: shareOf(row.value, waitingTotal),
                        detail: t('pullRequests.analytics.medianHold', {
                          hours: formatHours(row.medianHours),
                        }),
                      }))}
                    />
                  ) : (
                    <p className="m-0 text-sm text-fg-muted">
                      {t('pullRequests.analytics.nothingWaits')}
                    </p>
                  )}
                </Panel>
              </PanelGrid>
            </>
          );
        }}
      </QueryState>
    </>
  );
}
