import {
  AreaChart,
  ChartLegend,
  type ChartSeries,
  Panel,
  StatCard,
} from '@oppenheimer/design-system-web';
import { useSuspensePlanStats } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatCalendarDay, formatTokens, useLocale } from '@oppenheimer/frontend-web';
import { useDeferredValue } from 'react';
import { useTranslation } from 'react-i18next';
import { ProjectUsagePanels } from '../components/project-usage-panels';
import { StatsChange } from '../components/stats-change';
import { useStatsQuery } from '../hooks/use-stats-query';
import { formatUsd } from '../lib/format-usd';
import { niceTicks, peakOf, weeklyPoints } from '../lib/stats-chart';

/**
 * A project's Stats (the 2026-11-08 `Tasks` frame's project Stats, and
 * `23-plan-milestones-stats-accounts.md` §4): tasks completed and created,
 * and tokens and agent cost while any session reports them, each against
 * the period of the same length before. Pull requests are not in the API's
 * stats yet, so they are not drawn.
 *
 * Read under Suspense, in the screen's `QueryState`, with the range deferred:
 * a new range renders in the background and the one on screen stays until it
 * answers. A refetch that fails keeps the numbers and says so above them.
 */
export function ProjectStatsSection({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const query = useDeferredValue(useStatsQuery(projectId));
  const { data, error } = useSuspensePlanStats(query);
  const { current, previous } = data;
  const weekLabels = data.weeks.map((week) => formatCalendarDay(week, locale));
  const measured = data.tokensMeasured !== 'none' && (current.tokensByModel?.length ?? 0) > 0;
  const headless = t('projects.stats.headlessOnly');
  const taskSeries: ChartSeries[] = [
    { key: 'completed', label: t('projects.stats.completed'), tone: 'chart-1' },
    { key: 'created', label: t('projects.stats.created'), tone: 'chart-2' },
  ];
  const tasks = { completed: current.completedByWeek, created: current.createdByWeek };

  return (
    <>
      <ErrorAlert error={error} fallback={t('projects.stats.loadFailed')} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
        <StatCard
          label={t('projects.stats.tasksCompleted')}
          value={current.tasksCompleted}
          detail={
            <StatsChange
              now={current.tasksCompleted}
              before={previous?.tasksCompleted}
              higherIsBetter
            />
          }
        />
        <StatCard
          label={t('projects.stats.tasksCreated')}
          value={current.tasksCreated}
          detail={
            <StatsChange
              now={current.tasksCreated}
              before={previous?.tasksCreated}
              higherIsBetter={null}
            />
          }
        />
        {measured && current.tokens !== null ? (
          <StatCard
            label={t('projects.stats.tokens')}
            value={formatTokens(current.tokens, locale)}
            unit={headless}
            detail={
              <StatsChange now={current.tokens} before={previous?.tokens} higherIsBetter={null} />
            }
          />
        ) : null}
        {measured && current.costUsd !== null ? (
          <StatCard
            label={t('projects.stats.cost')}
            value={formatUsd(current.costUsd, locale)}
            unit={headless}
            detail={
              <StatsChange
                now={current.costUsd}
                before={previous?.costUsd}
                higherIsBetter={false}
              />
            }
          />
        ) : null}
      </div>
      <Panel title={t('projects.stats.tasksTitle')} meta={<ChartLegend series={taskSeries} />}>
        <AreaChart
          series={taskSeries}
          points={weeklyPoints(weekLabels, tasks)}
          ticks={niceTicks(peakOf(tasks))}
          aria-label={t('projects.stats.tasksTitle')}
        />
      </Panel>
      <ProjectUsagePanels
        current={current}
        measured={measured}
        weekLabels={weekLabels}
        locale={locale}
      />
    </>
  );
}
