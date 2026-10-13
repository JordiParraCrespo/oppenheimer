import {
  AreaChart,
  ChartLegend,
  type ChartSeries,
  Panel,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { usePlanStats } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatCalendarDay, useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { useStatsPeriod } from '../hooks/use-stats-period';
import { ticksFor } from '../lib/stats';
import { formatCompact, formatUsd } from '../lib/stats-format';

const TONES = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'] as const;

/**
 * Stats' volume over the period, a week a point: tasks completed against
 * created, tokens per model, and what the agents cost. The token and cost
 * charts appear once the turns report usage; until then a line says why.
 */
export function StatsCharts() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { request } = useStatsPeriod();
  const stats = usePlanStats(request);

  if (stats.isPending) return <Skeleton className="h-64 w-full" />;
  if (stats.isError)
    return <ErrorAlert error={stats.error} fallback={t('tasks.stats.loadFailed')} />;

  const { weeks, current, tokensMeasured } = stats.data;
  const label = (week: string) => formatCalendarDay(week, locale, 'short');
  const taskSeries: ChartSeries[] = [
    { key: 'completed', label: t('tasks.stats.series.completed'), tone: 'chart-1' },
    { key: 'created', label: t('tasks.stats.series.created'), tone: 'chart-2' },
  ];
  const tasksMax = Math.max(0, ...current.completedByWeek, ...current.createdByWeek);
  const models = (current.tokensByModel ?? []).slice(0, TONES.length);
  const modelSeries: ChartSeries[] = models.map((row, index) => ({
    key: `m${index}`,
    label: row.model ?? t('tasks.stats.series.unknownModel'),
    tone: TONES[index] ?? 'muted',
  }));
  const tokensMax = Math.max(
    0,
    ...weeks.map((_, i) => Math.max(0, ...models.map((m) => m.byWeek[i] ?? 0))),
  );
  const costMax = Math.max(0, ...(current.costByWeek ?? []));

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Panel
        title={t('tasks.stats.charts.tasks')}
        meta={<ChartLegend series={taskSeries} />}
        className="lg:col-span-2"
      >
        <AreaChart
          series={taskSeries}
          points={weeks.map((week, i) => ({
            label: label(week),
            values: {
              completed: current.completedByWeek[i] ?? 0,
              created: current.createdByWeek[i] ?? 0,
            },
          }))}
          ticks={ticksFor(tasksMax)}
          aria-label={t('tasks.stats.charts.tasks')}
        />
      </Panel>
      {tokensMeasured === 'none' || models.length === 0 ? (
        <Panel title={t('tasks.stats.charts.tokens')} className="lg:col-span-2">
          <p className="m-0 text-sm text-fg-muted">{t('tasks.stats.tokensPending')}</p>
        </Panel>
      ) : (
        <>
          <Panel title={t('tasks.stats.charts.tokens')} meta={<ChartLegend series={modelSeries} />}>
            <AreaChart
              series={modelSeries}
              points={weeks.map((week, i) => ({
                label: label(week),
                values: Object.fromEntries(
                  models.map((m, index) => [`m${index}`, m.byWeek[i] ?? 0]),
                ),
              }))}
              ticks={ticksFor(tokensMax)}
              format={(value) => formatCompact(value, locale)}
              aria-label={t('tasks.stats.charts.tokens')}
            />
          </Panel>
          <Panel title={t('tasks.stats.charts.cost')}>
            <AreaChart
              series={[{ key: 'cost', label: t('tasks.stats.charts.cost'), tone: 'chart-3' }]}
              points={weeks.map((week, i) => ({
                label: label(week),
                values: { cost: current.costByWeek?.[i] ?? 0 },
              }))}
              ticks={ticksFor(costMax)}
              format={(value) => formatUsd(value, locale)}
              aria-label={t('tasks.stats.charts.cost')}
            />
          </Panel>
        </>
      )}
    </div>
  );
}
