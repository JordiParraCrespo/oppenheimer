'use client';

import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * The review analytics' charts, drawn in HTML and SVG on the chart tokens
 * (`--chart-1` blue, `--chart-2` teal, `--chart-3` violet, a categorical
 * order validated for colour-blind separation in both themes). Thin marks,
 * one axis, the grid recessive, values in mono and in text ink, never the
 * series colour; every chart answers the pointer, and every chart with two
 * or more series carries a legend.
 *
 * - `ChartHero`: the headline figure of a series: its dot and name, the
 *   number at 40px mono, and its change against the period before.
 * - `BarChart`: grouped columns per day (created and merged), up to 16px
 *   wide with 3px between a group's bars, the x labels in mono with the
 *   month under the first day of each; hovering a day lifts it, fades the
 *   others and reads its values out above the chart.
 * - `LineChart`: two series over time with a crosshair, a dot per series on
 *   the hovered point, ticks on the right, and the readout above.
 * - `RingChart`: shares of a whole (the lane mix) as a ring with rounded
 *   arcs and gaps, the total in the middle; its rows are `ChartRow`s.
 * - `BarList`: ranked rows (why pull requests waited), each a label, a
 *   share bar on the hover track, the value and its previous one.
 * - `ChartLegend`: the series' dots and names, under a chart.
 */

type ChartTone = 'chart-1' | 'chart-2' | 'chart-3' | 'chart-4' | 'chart-5' | 'muted';

const BG: Record<ChartTone, string> = {
  'chart-1': 'bg-chart-1',
  'chart-2': 'bg-chart-2',
  'chart-3': 'bg-chart-3',
  'chart-4': 'bg-chart-4',
  'chart-5': 'bg-chart-5',
  muted: 'bg-fg-subtle',
};
const STROKE: Record<ChartTone, string> = {
  'chart-1': 'var(--chart-1)',
  'chart-2': 'var(--chart-2)',
  'chart-3': 'var(--chart-3)',
  'chart-4': 'var(--chart-4)',
  'chart-5': 'var(--chart-5)',
  muted: 'var(--fg-subtle)',
};

interface ChartSeries {
  key: string;
  label: string;
  tone: ChartTone;
}

/** The default value format: the number as it is. */
const plain = (value: number) => String(value);

function Dot({ tone, className }: { tone: ChartTone; className?: string }) {
  return <span aria-hidden className={cn('size-2 shrink-0 rounded-pill', BG[tone], className)} />;
}

function ChartHero({
  tone,
  label,
  value,
  delta,
  className,
}: {
  tone?: ChartTone;
  label: React.ReactNode;
  value: React.ReactNode;
  /** A `StatDelta`. */
  delta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="chart-hero" className={cn('flex flex-col gap-1.5', className)}>
      <span className="flex items-center gap-[7px] text-sm text-fg-muted">
        {tone ? <Dot tone={tone} /> : null}
        {label}
      </span>
      <span className="figures text-[40px] leading-none font-medium tracking-[-0.024em] text-fg">{value}</span>
      {delta}
    </div>
  );
}

function ChartLegend({ series, className }: { series: readonly ChartSeries[]; className?: string }) {
  return (
    <div data-slot="chart-legend" className={cn('flex flex-wrap items-center gap-4 text-xs text-fg-muted', className)}>
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <Dot tone={s.tone} className="size-1.5" />
          {s.label}
        </span>
      ))}
    </div>
  );
}

interface BarDatum {
  key: string;
  /** The x label, mono ("5"). */
  label: string;
  /** Under the label: the month on the first day of one ("Sep"). */
  sublabel?: string;
  values: Record<string, number>;
}

function BarChart({
  series,
  data,
  height = 220,
  format = plain,
  readout,
  className,
  'aria-label': ariaLabel,
}: {
  series: readonly ChartSeries[];
  data: readonly BarDatum[];
  height?: number;
  format?: (value: number) => string;
  /** The words above the chart while nothing is hovered. */
  readout?: React.ReactNode;
  className?: string;
  'aria-label': string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0)));
  const hovered = hover === null ? null : data[hover];
  return (
    <figure data-slot="bar-chart" className={cn('m-0 flex min-w-0 flex-col gap-2', className)} aria-label={ariaLabel}>
      <figcaption className="figures flex min-h-4 items-center justify-end gap-3 text-xs text-fg">
        {hovered ? (
          <>
            <span className="text-fg-muted">
              {hovered.sublabel ? `${hovered.sublabel} ` : ''}
              {hovered.label}
            </span>
            {series.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5">
                <Dot tone={s.tone} className="size-1.5" />
                {format(hovered.values[s.key] ?? 0)}
              </span>
            ))}
          </>
        ) : (
          <span className="text-fg-muted">{readout}</span>
        )}
      </figcaption>
      <div
        role="list"
        className="flex items-end gap-[5px]"
        // biome-ignore lint/style/noInlineStyles: the plot's height is the caller's.
        style={{ height }}
        onMouseLeave={() => setHover(null)}
      >
        {data.map((d, i) => (
          <div
            key={d.key}
            role="listitem"
            aria-label={`${d.sublabel ? `${d.sublabel} ` : ''}${d.label}: ${series.map((s) => `${s.label} ${format(d.values[s.key] ?? 0)}`).join(', ')}`}
            onMouseEnter={() => setHover(i)}
            className="flex h-full min-w-0 flex-1 items-end justify-center gap-[3px]"
          >
            {series.map((s) => (
              <span
                key={s.key}
                className={cn(
                  'max-w-4 min-w-0 flex-1 rounded-t-[4px] transition-[height,opacity] duration-slow ease-out',
                  BG[s.tone],
                  hover !== null && hover !== i && 'opacity-35',
                )}
                // biome-ignore lint/style/noInlineStyles: the bar's height is the value.
                style={{ height: `${((d.values[s.key] ?? 0) / max) * 100}%` }}
              />
            ))}
          </div>
        ))}
      </div>
      <div aria-hidden className="flex gap-[5px]">
        {data.map((d, i) => (
          <span
            key={d.key}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 overflow-visible text-[11px] leading-[14px] whitespace-nowrap"
          >
            <span className={cn('figures', hover === i ? 'text-fg' : 'text-fg-subtle')}>{d.label}</span>
            {d.sublabel ? <span className="text-fg-muted">{d.sublabel}</span> : null}
          </span>
        ))}
      </div>
    </figure>
  );
}

interface LinePoint {
  label: string;
  values: Record<string, number>;
}

function LineChart({
  series,
  points,
  ticks,
  height = 160,
  format = plain,
  from,
  to,
  className,
  'aria-label': ariaLabel,
}: {
  series: readonly ChartSeries[];
  points: readonly LinePoint[];
  /** Y values to rule and label, ascending; the last is the top. */
  ticks: readonly number[];
  height?: number;
  format?: (value: number) => string;
  /** The x axis's two ends ("Sep 5", "Oct 4"). */
  from?: React.ReactNode;
  to?: React.ReactNode;
  className?: string;
  'aria-label': string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const top = ticks[ticks.length - 1] ?? Math.max(1, ...points.flatMap((p) => Object.values(p.values)));
  const x = (i: number) => (points.length < 2 ? 50 : (i / (points.length - 1)) * 100);
  const y = (v: number) => 100 - (Math.min(v, top) / top) * 100;
  const path = (key: string) => points.map((p, i) => `${i ? 'L' : 'M'}${x(i)} ${y(p.values[key] ?? 0)}`).join(' ');
  const hovered = hover === null ? null : points[hover];
  return (
    <figure data-slot="line-chart" className={cn('m-0 flex min-w-0 flex-col gap-2', className)} aria-label={ariaLabel}>
      <figcaption className="figures flex min-h-4 items-center justify-end gap-3 text-xs text-fg">
        {hovered ? (
          <>
            <span className="text-fg-muted">{hovered.label}</span>
            {series.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5">
                <Dot tone={s.tone} className="size-1.5" />
                {format(hovered.values[s.key] ?? 0)}
              </span>
            ))}
          </>
        ) : null}
      </figcaption>
      <div className="grid grid-cols-[minmax(0,1fr)_34px] gap-x-2.5">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: the hover readout repeats the figure's data, which the list below carries for assistive technology. */}
        <div
          className="relative"
          // biome-ignore lint/style/noInlineStyles: the plot's height is the caller's.
          style={{ height }}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <span
              key={t}
              aria-hidden
              className="absolute inset-x-0 h-px bg-border-subtle"
              // biome-ignore lint/style/noInlineStyles: the rule sits at its value.
              style={{ bottom: `${(t / top) * 100}%` }}
            />
          ))}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className="absolute inset-0 size-full overflow-visible">
            {series.map((s) => (
              <path
                key={s.key}
                d={path(s.key)}
                fill="none"
                stroke={STROKE[s.tone]}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
          </svg>
          {hovered && hover !== null ? (
            <>
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-px bg-border"
                // biome-ignore lint/style/noInlineStyles: the crosshair follows the pointer.
                style={{ left: `${x(hover)}%` }}
              />
              {series.map((s) => (
                <span
                  key={s.key}
                  aria-hidden
                  className={cn('pointer-events-none absolute -mb-[4.5px] -ml-[4.5px] size-[9px] rounded-pill shadow-[0_0_0_2px_var(--card)]', BG[s.tone])}
                  // biome-ignore lint/style/noInlineStyles: the dot sits on the value.
                  style={{ left: `${x(hover)}%`, bottom: `${100 - y(hovered.values[s.key] ?? 0)}%` }}
                />
              ))}
            </>
          ) : null}
          <div className="absolute inset-0 flex">
            {points.map((p, i) => (
              <span key={p.label} aria-hidden className="h-full flex-1" onMouseEnter={() => setHover(i)} />
            ))}
          </div>
        </div>
        <div aria-hidden className="relative" style={{ height }}>
          {ticks.map((t) => (
            <span
              key={t}
              className="figures absolute left-0 translate-y-1/2 text-[11px] text-fg-subtle"
              // biome-ignore lint/style/noInlineStyles: the label sits at its value.
              style={{ bottom: `${(t / top) * 100}%` }}
            >
              {format(t)}
            </span>
          ))}
        </div>
      </div>
      {from || to ? (
        <div aria-hidden className="flex justify-between pr-11 text-[11px] text-fg-subtle">
          <span>{from}</span>
          <span>{to}</span>
        </div>
      ) : null}
      <ul className="sr-only">
        {points.map((p) => (
          <li key={p.label}>
            {p.label}: {series.map((s) => `${s.label} ${format(p.values[s.key] ?? 0)}`).join(', ')}
          </li>
        ))}
      </ul>
    </figure>
  );
}

function RingChart({
  segments,
  label,
  value,
  size = 148,
  className,
}: {
  segments: readonly { key: string; label: string; value: number; tone: ChartTone }[];
  /** In the middle, over the total: "Merged". */
  label?: React.ReactNode;
  value?: React.ReactNode;
  size?: number;
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  // A 4-unit gap between arcs on a 100-unit circumference, so the round caps never touch.
  const gap = segments.length > 1 ? 4 : 0;
  const starts = segments.map((_, i) => segments.slice(0, i).reduce((sum, s) => sum + (s.value / total) * 100, 0));
  return (
    <div
      data-slot="ring-chart"
      role="img"
      aria-label={segments.map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(', ')}
      className={cn('relative self-center', className)}
      // biome-ignore lint/style/noInlineStyles: the ring's size is the caller's.
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
        {segments.map((s, i) => {
          const length = Math.max(0, (s.value / total) * 100 - gap);
          return (
            <circle
              key={s.key}
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke={STROKE[s.tone]}
              strokeWidth={7}
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${length} ${100 - length}`}
              strokeDashoffset={-(starts[i] ?? 0) - gap / 2}
            />
          );
        })}
      </svg>
      {label || value ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          {label ? <span className="text-xs text-fg-muted">{label}</span> : null}
          {value ? <span className="figures text-[26px] leading-none font-medium tracking-[-0.02em] text-fg">{value}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/** A row under a ring or beside a chart: dot and name, the value, its share, its change. */
function ChartRow({
  tone,
  label,
  value,
  share,
  delta,
  className,
}: {
  tone?: ChartTone;
  label: React.ReactNode;
  value: React.ReactNode;
  share?: React.ReactNode;
  /** A `StatDelta` without words, or a toned figure. */
  delta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="chart-row"
      className={cn(
        'grid min-h-[38px] grid-cols-[minmax(0,1fr)_auto_44px_52px] items-center gap-2.5 border-t border-border-subtle text-[13.5px]',
        className,
      )}
    >
      <span className="flex min-w-0 items-center gap-2 text-fg">
        {tone ? <Dot tone={tone} /> : null}
        <span className="truncate">{label}</span>
      </span>
      <span className="figures font-medium text-fg">{value}</span>
      <span className="figures text-right text-xs text-fg-muted">{share}</span>
      <span className="text-right">{delta}</span>
    </div>
  );
}

function BarList({
  rows,
  className,
}: {
  rows: readonly { key: string; label: React.ReactNode; value: React.ReactNode; share: number; previous?: React.ReactNode; detail?: React.ReactNode }[];
  className?: string;
}) {
  return (
    <ul data-slot="bar-list" className={cn('m-0 flex list-none flex-col gap-3 p-0', className)}>
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-1.5">
          <span className="flex items-baseline gap-2 text-[13.5px]">
            <span className="min-w-0 flex-1 truncate text-fg">{row.label}</span>
            <span className="figures font-medium text-fg">{row.value}</span>
            {row.previous !== undefined ? <span className="figures w-12 text-right text-xs text-fg-subtle">{row.previous}</span> : null}
          </span>
          <span aria-hidden className="h-1.5 overflow-hidden rounded-pill bg-hover-surface">
            <span
              className="block h-full rounded-pill bg-chart-1 transition-[width] duration-slow ease-out"
              // biome-ignore lint/style/noInlineStyles: the share is data.
              style={{ width: `${Math.max(0, Math.min(100, row.share))}%` }}
            />
          </span>
          {row.detail ? <span className="text-xs text-fg-muted">{row.detail}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export { BarChart, BarList, ChartHero, ChartLegend, ChartRow, LineChart, RingChart };
export type { BarDatum, ChartSeries, ChartTone, LinePoint };
