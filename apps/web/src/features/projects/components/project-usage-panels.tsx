import {
  AreaChart,
  ChartLegend,
  type ChartSeries,
  Panel,
  PanelGrid,
} from '@oppenheimer/design-system-web';
import type { PlanStats } from '@oppenheimer/frontend-consumer';
import { formatTokens } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { formatUsd } from '../lib/format-usd';
import { modelSeriesOf } from '../lib/model-series';
import { niceTicks, peakOf, weeklyPoints } from '../lib/stats-chart';

const MODEL_TONES = ['chart-1', 'chart-2', 'chart-3', 'muted'] as const;

/**
 * A project's Stats for tokens and cost, once a session has reported usage:
 * tokens per model and cost per week, each said to be measured on headless
 * turns.
 */
export function ProjectUsagePanels({
  current,
  weekLabels,
  locale,
}: {
  current: PlanStats['current'];
  weekLabels: readonly string[];
  locale: string;
}) {
  const { t } = useTranslation();

  const models = modelSeriesOf(current.tokensByModel ?? [], MODEL_TONES.length - 1);
  const modelSeries: ChartSeries[] = models.map((row, index) => ({
    key: String(index),
    label:
      row.model === 'other'
        ? t('projects.stats.otherModels')
        : (row.model ?? t('projects.stats.unknownModel')),
    tone: MODEL_TONES[index] ?? 'muted',
  }));
  const tokens = Object.fromEntries(models.map((row, index) => [String(index), row.byWeek]));
  const cost = { cost: current.costByWeek ?? [] };

  return (
    <PanelGrid>
      <Panel title={t('projects.stats.tokensTitle')} meta={<ChartLegend series={modelSeries} />}>
        <span className="text-xs text-fg-muted">{t('projects.stats.measuredHeadless')}</span>
        <AreaChart
          series={modelSeries}
          points={weeklyPoints(weekLabels, tokens)}
          ticks={niceTicks(peakOf(tokens))}
          format={(value) => formatTokens(value, locale)}
          aria-label={t('projects.stats.tokensTitle')}
        />
      </Panel>
      <Panel title={t('projects.stats.costTitle')} meta={t('projects.stats.measuredHeadless')}>
        <AreaChart
          series={[{ key: 'cost', label: t('projects.stats.cost'), tone: 'chart-3' }]}
          points={weeklyPoints(weekLabels, cost)}
          ticks={niceTicks(peakOf(cost))}
          format={(value) => formatUsd(value, locale)}
          aria-label={t('projects.stats.costTitle')}
        />
      </Panel>
    </PanelGrid>
  );
}
