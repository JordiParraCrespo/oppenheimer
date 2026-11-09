import {
  AreaChart,
  ChartLegend,
  type ChartSeries,
  Panel,
  PanelGrid,
  ProjectPanelEmpty,
  StatCard,
  StatDelta,
} from '@oppenheimer/design-system-web';
import { useSuspensePlanStats } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatCalendarDay, formatTokens, useLocale } from '@oppenheimer/frontend-web';
import { useDeferredValue } from 'react';
import { useTranslation } from 'react-i18next';
import { useStatsQuery } from '../hooks/use-stats-query';
import { formatUsd } from '../lib/format-usd';
import { changeOf, niceTicks } from '../lib/stats-range';

const MODEL_TONES = ['chart-1', 'chart-2', 'chart-3'] as const;

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
  const week = (index: number) => formatCalendarDay(data.weeks[index] ?? '', locale);
  const measured =
    data.tokensMeasured !== 'none' &&
    current.tokensByModel !== null &&
    current.tokensByModel.length > 0;

  const delta = (
    now: number | null,
    before: number | null | undefined,
    higherIsBetter: boolean | null,
  ) => {
    const change = changeOf(now, before, higherIsBetter);
    return change ? (
      <StatDelta value={change.value} tone={change.tone}>
        {t('projects.stats.vsPrevious')}
      </StatDelta>
    ) : (
      t('projects.stats.noPrevious')
    );
  };

  const taskSeries: ChartSeries[] = [
    { key: 'completed', label: t('projects.stats.completed'), tone: 'chart-1' },
    { key: 'created', label: t('projects.stats.created'), tone: 'chart-2' },
  ];
  const taskMax = Math.max(0, ...current.completedByWeek, ...current.createdByWeek);

  const models = (current.tokensByModel ?? []).slice(0, MODEL_TONES.length);
  const modelSeries: ChartSeries[] = models.map((row, index) => ({
    key: String(index),
    label: row.model ?? t('projects.stats.unknownModel'),
    tone: MODEL_TONES[index] ?? 'chart-1',
  }));
  const tokenMax = Math.max(
    0,
    ...data.weeks.map((_, i) => Math.max(0, ...models.map((m) => m.byWeek[i] ?? 0))),
  );
  const costByWeek = current.costByWeek ?? [];

  return (
    <>
      <ErrorAlert error={error} fallback={t('projects.stats.loadFailed')} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
        <StatCard
          label={t('projects.stats.tasksCompleted')}
          value={current.tasksCompleted}
          detail={delta(current.tasksCompleted, previous?.tasksCompleted, true)}
        />
        <StatCard
          label={t('projects.stats.tasksCreated')}
          value={current.tasksCreated}
          detail={delta(current.tasksCreated, previous?.tasksCreated, null)}
        />
        {measured && current.tokens !== null ? (
          <StatCard
            label={t('projects.stats.tokens')}
            value={formatTokens(current.tokens, locale)}
            detail={delta(current.tokens, previous?.tokens, null)}
          />
        ) : null}
        {measured && current.costUsd !== null ? (
          <StatCard
            label={t('projects.stats.cost')}
            value={formatUsd(current.costUsd, locale)}
            detail={delta(current.costUsd, previous?.costUsd, false)}
          />
        ) : null}
      </div>
      <Panel title={t('projects.stats.tasksTitle')} meta={<ChartLegend series={taskSeries} />}>
        <AreaChart
          series={taskSeries}
          points={data.weeks.map((_, i) => ({
            label: week(i),
            values: {
              completed: current.completedByWeek[i] ?? 0,
              created: current.createdByWeek[i] ?? 0,
            },
          }))}
          ticks={niceTicks(taskMax)}
          aria-label={t('projects.stats.tasksTitle')}
        />
      </Panel>
      {measured ? (
        <PanelGrid>
          <Panel
            title={t('projects.stats.tokensTitle')}
            meta={<ChartLegend series={modelSeries} />}
          >
            <AreaChart
              series={modelSeries}
              points={data.weeks.map((_, i) => ({
                label: week(i),
                values: Object.fromEntries(
                  models.map((m, index) => [String(index), m.byWeek[i] ?? 0]),
                ),
              }))}
              ticks={niceTicks(tokenMax)}
              format={(value) => formatTokens(value, locale)}
              aria-label={t('projects.stats.tokensTitle')}
            />
          </Panel>
          <Panel title={t('projects.stats.costTitle')}>
            <AreaChart
              series={[{ key: 'cost', label: t('projects.stats.cost'), tone: 'chart-3' }]}
              points={data.weeks.map((_, i) => ({
                label: week(i),
                values: { cost: costByWeek[i] ?? 0 },
              }))}
              ticks={niceTicks(Math.max(0, ...costByWeek))}
              format={(value) => formatUsd(value, locale)}
              aria-label={t('projects.stats.costTitle')}
            />
          </Panel>
        </PanelGrid>
      ) : (
        <Panel title={t('projects.stats.usageTitle')}>
          <ProjectPanelEmpty>{t('projects.stats.notMeasured')}</ProjectPanelEmpty>
        </Panel>
      )}
    </>
  );
}
