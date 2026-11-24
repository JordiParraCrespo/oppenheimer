import {
  AreaChart,
  BarChart,
  ChartLegend,
  type ChartSeries,
  LineChart,
  SegmentedControl,
  SegmentedControlItem,
} from '@oppenheimer/design-system-web';
import type { VisualChartBlock } from '@oppenheimer/shared/schemas/visual';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRevealed } from '../hooks/use-revealed';
import { formatVisualNumber, niceTicks, seriesTone } from '../lib/visual-format';
import { VisualBlockTitle } from './visual-block-title';
import { VisualTable } from './visual-table';

/** Every nth label, so a long axis never crowds: at most about eight. */
function thinned(labels: readonly string[]): (index: number) => boolean {
  const every = Math.max(1, Math.ceil(labels.length / 8));
  return (index) => index % every === 0 || index === labels.length - 1;
}

/**
 * A bar, line or area chart on the design system's charts, with a legend for
 * two or more series and a switch to the same numbers as a table. Bars grow
 * from the axis the first time they are shown.
 */
export function VisualChart({ block }: { block: VisualChartBlock }) {
  const { t } = useTranslation();
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const revealed = useRevealed();
  const series: ChartSeries[] = block.series.map((s, index) => ({
    key: `s${index}`,
    label: s.label,
    tone: seriesTone(index),
  }));
  // The axis has a narrow column: a suffix sits tight to its figure there ("300ms").
  const tight = block.format?.suffix
    ? { ...block.format, suffix: block.format.suffix.trim() }
    : block.format;
  const format = (value: number) => formatVisualNumber(value, tight);
  const ariaLabel = t('common.visual.chartLabel', {
    title: block.title ?? block.series.map((s) => s.label).join(', '),
    kind: t(`common.visual.kinds.${block.type}`),
  });
  const values = (index: number, grown: boolean) =>
    Object.fromEntries(block.series.map((s, i) => [`s${i}`, grown ? (s.values[index] ?? 0) : 0]));

  const chart = () => {
    if (block.type === 'bar') {
      const shown = thinned(block.labels);
      return (
        <BarChart
          aria-label={ariaLabel}
          height={180}
          series={series}
          format={format}
          data={block.labels.map((label, index) => ({
            key: `${label}-${index}`,
            label: shown(index) ? label : '',
            readoutLabel: label,
            // The first frame draws every bar at zero, so each grows to its value.
            values: values(index, revealed),
          }))}
        />
      );
    }
    const points = block.labels.map((label, index) => ({ label, values: values(index, true) }));
    const ticks = niceTicks(block.series.flatMap((s) => s.values));
    if (block.type === 'line') {
      return (
        <LineChart
          aria-label={ariaLabel}
          height={170}
          series={series}
          points={points}
          ticks={ticks}
          format={format}
          from={block.labels[0]}
          to={block.labels.length > 1 ? block.labels.at(-1) : undefined}
        />
      );
    }
    return (
      <AreaChart
        aria-label={ariaLabel}
        height={180}
        series={series}
        points={
          block.labels.length > 12
            ? points.map((p, i) => ({ ...p, label: thinned(block.labels)(i) ? p.label : '' }))
            : points
        }
        ticks={ticks}
        format={format}
      />
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <VisualBlockTitle>{block.title}</VisualBlockTitle>
        <SegmentedControl
          aria-label={t('common.visual.viewAs')}
          value={view}
          onValueChange={(next) => setView(next === 'table' ? 'table' : 'chart')}
          className="opacity-70 transition-opacity duration-fast group-hover/visual:opacity-100 focus-within:opacity-100"
        >
          <SegmentedControlItem value="chart">{t('common.visual.chart')}</SegmentedControlItem>
          <SegmentedControlItem value="table">{t('common.visual.table')}</SegmentedControlItem>
        </SegmentedControl>
      </div>
      {view === 'chart' ? (
        <div key="chart" className="flex min-w-0 flex-col gap-3 motion-safe:animate-appear-fast">
          {chart()}
          {series.length > 1 ? <ChartLegend series={series} /> : null}
        </div>
      ) : (
        <div key="table" className="motion-safe:animate-appear-fast">
          <VisualTable
            block={{
              type: 'table',
              columns: [
                { label: t('common.visual.label') },
                ...block.series.map((s) => ({
                  label: s.label,
                  align: 'right' as const,
                  format: block.format,
                })),
              ],
              rows: block.labels.map((label, index) => [
                label,
                ...block.series.map((s) => s.values[index] ?? null),
              ]),
            }}
          />
        </div>
      )}
    </div>
  );
}
