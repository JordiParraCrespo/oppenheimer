'use client';

import * as React from 'react';

import { type DataTone, TONE_BG, TONE_STROKE } from '../internal/data-tone';
import { cn } from '../lib/utils';
import { StatBar } from './stat-card';

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
 * - `BarChart`: grouped columns per day (created and merged), pills up to
 *   16px wide with 3px between a group's bars (the export's `980px` radius,
 *   both ends round), the x labels in mono with the
 *   month under the first day of each; hovering a day lifts it, fades the
 *   others and reads its values out above the chart.
 * - `LineChart`: two series over time with a crosshair, a dot per series on
 *   the hovered point, ticks on the right, and the readout above.
 * - `AreaChart`: volume over time (Plan's Stats): monotone curves over a
 *   wash of their tone, ticks on the left, a label under every point.
 * - `RingChart`: shares of a whole (the lane mix) as a ring with rounded
 *   arcs and gaps, the total in the middle; its rows are `ChartRow`s.
 * - `BarList`: ranked rows (why pull requests waited), each a label, the
 *   value and its previous one over a `StatBar` share.
 * - `ChartLegend`: the series' dots and names, under a chart.
 */

interface ChartSeries {
  key: string;
  label: string;
  tone: DataTone;
}

/** The default value format: the number as it is. */
const plain = (value: number) => String(value);

function Dot({ tone, className }: { tone: DataTone; className?: string }) {
  return <span aria-hidden className={cn('size-2 shrink-0 rounded-pill', TONE_BG[tone], className)} />;
}

function ChartHero({
  tone,
  label,
  value,
  delta,
  className,
}: {
  tone?: DataTone;
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

/**
 * What a chart reads out above itself while a point is hovered: the
 * point's label, muted, then each series' dot and value in mono, in text
 * ink. Without a point it shows `idle`.
 */
function ChartReadout({
  series,
  label,
  values,
  format,
  idle,
}: {
  series: readonly ChartSeries[];
  label?: string;
  values?: Record<string, number>;
  format: (value: number) => string;
  idle?: React.ReactNode;
}) {
  return (
    <figcaption className="figures flex min-h-4 items-center justify-end gap-3 text-xs text-fg">
      {values ? (
        <>
          <span className="text-fg-muted">{label}</span>
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <Dot tone={s.tone} className="size-1.5" />
              {format(values[s.key] ?? 0)}
            </span>
          ))}
        </>
      ) : (
        <span className="text-fg-muted">{idle}</span>
      )}
    </figcaption>
  );
}

interface BarDatum {
  key: string;
  /** The x label, mono ("5"). */
  label: string;
  /** Under the label: the month on the first day of one ("Sep"). */
  sublabel?: string;
  /** What the readout calls this bar when the axis's own words are not enough ("Week of Aug 3"). */
  readoutLabel?: string;
  values: Record<string, number>;
}

/**
 * How many x labels the axis draws at most. A day chart over a quarter is
 * ninety bars of eight pixels, and a label on every one of them is a label on
 * none: they overlap into a single grey smear. Past this many, the axis keeps
 * an evenly spaced subset — every bar still draws, and still answers the
 * pointer and the screen reader with its own date.
 */
const MAX_X_LABELS = 16;

/**
 * The bars whose label is drawn: evenly spaced, and always a month's first
 * day, never more than {@link MAX_X_LABELS} of them.
 *
 * The ceiling is the whole point, so a bar carrying a `sublabel` does not get
 * a label *added* on top of the evenly spaced set — it takes the place of the
 * nearest one. Treating "has a sublabel" as "must be labelled" let a month of
 * day bars draw its stride plus every 1st, which is the smear this exists to
 * prevent.
 */
function labelledBars(data: readonly BarDatum[]): (datum: BarDatum, index: number) => boolean {
  if (data.length <= MAX_X_LABELS) return () => true;
  const stride = Math.ceil(data.length / MAX_X_LABELS);
  const chosen = new Set<number>();
  for (let index = 0; index < data.length; index += stride) chosen.add(index);
  const months = data.flatMap((datum, index) => (datum.sublabel === undefined ? [] : [index]));
  const isMonth = new Set(months);
  for (const index of months) {
    if (chosen.has(index)) continue;
    if (chosen.size >= MAX_X_LABELS) {
      let nearest: number | null = null;
      for (const candidate of chosen) {
        if (isMonth.has(candidate)) continue;
        if (nearest === null || Math.abs(candidate - index) < Math.abs(nearest - index))
          nearest = candidate;
      }
      // Every label is already a month's: there is no room to make.
      if (nearest === null) continue;
      chosen.delete(nearest);
    }
    chosen.add(index);
  }
  return (_datum, index) => chosen.has(index);
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
  const labelled = labelledBars(data);
  return (
    <figure data-slot="bar-chart" className={cn('m-0 flex min-w-0 flex-col gap-2', className)} aria-label={ariaLabel}>
      <ChartReadout
        series={series}
        label={
          hovered
            ? (hovered.readoutLabel ??
              `${hovered.sublabel ? `${hovered.sublabel} ` : ''}${hovered.label}`)
            : undefined
        }
        values={hovered?.values}
        format={format}
        idle={readout}
      />
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
                  'max-w-4 min-w-0 flex-1 rounded-pill transition-[height,opacity] duration-slow ease-out',
                  TONE_BG[s.tone],
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
        {data.map((d, i) => {
          // The hovered bar names itself even where the axis is thinned, so a
          // reader can always read the day under the pointer.
          const drawn = labelled(d, i) || hover === i;
          return (
            <span
              key={d.key}
              className="flex min-w-0 flex-1 flex-col items-center gap-0.5 overflow-visible text-[11px] leading-[14px] whitespace-nowrap"
            >
              {drawn ? (
                <span className={cn('figures', hover === i ? 'text-fg' : 'text-fg-subtle')}>
                  {d.label}
                </span>
              ) : null}
              {drawn && d.sublabel ? <span className="text-fg-muted">{d.sublabel}</span> : null}
            </span>
          );
        })}
      </div>
    </figure>
  );
}

interface LinePoint {
  label: string;
  values: Record<string, number>;
}

/**
 * A monotone cubic through the points (Fritsch–Carlson): smooth, and it never
 * overshoots a value, so a curve never dips under zero or above a peak.
 */
function monotonePath(points: readonly (readonly [number, number])[]) {
  const n = points.length;
  const first = points[0];
  if (!first) return '';
  if (n < 2) return `M${first[0]} ${first[1]}`;
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i] as [number, number];
    const [x1, y1] = points[i + 1] as [number, number];
    slope.push((y1 - y0) / (x1 - x0));
  }
  const m: number[] = points.map((_, i) => {
    if (i === 0) return slope[0] ?? 0;
    if (i === n - 1) return slope[n - 2] ?? 0;
    const a = slope[i - 1] ?? 0;
    const b = slope[i] ?? 0;
    return a * b <= 0 ? 0 : (a + b) / 2;
  });
  for (let i = 0; i < n - 1; i++) {
    const d = slope[i] ?? 0;
    if (d === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = (m[i] ?? 0) / d;
    const b = (m[i + 1] ?? 0) / d;
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d;
      m[i + 1] = t * b * d;
    }
  }
  let out = `M${first[0]} ${first[1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i] as [number, number];
    const [x1, y1] = points[i + 1] as [number, number];
    const h = (x1 - x0) / 3;
    out += ` C${x0 + h} ${y0 + (m[i] ?? 0) * h} ${x1 - h} ${y1 - (m[i + 1] ?? 0) * h} ${x1} ${y1}`;
  }
  return out;
}

/**
 * The frame `LineChart` and `AreaChart` share: the readout over the plot,
 * the rules at the ticks, the ticks on one side, the crosshair and a dot per
 * series on the hovered point, and the points listed for assistive
 * technology. The two charts differ only in how a series is drawn (`draw`),
 * which side the ticks sit on, and the x axis under the plot.
 */
function TimeSeries({
  slot,
  series,
  points,
  ticks,
  height,
  format,
  tickSide,
  draw,
  xAxis,
  className,
  'aria-label': ariaLabel,
}: {
  slot: string;
  series: readonly ChartSeries[];
  points: readonly LinePoint[];
  ticks: readonly number[];
  height: number;
  format: (value: number) => string;
  tickSide: 'left' | 'right';
  /** One series' marks inside the 100×100 plot, given its points there. */
  draw: (s: ChartSeries, at: readonly (readonly [number, number])[]) => React.ReactNode;
  /** What sits under the plot, given the hovered index and the x of a point (0–100). */
  xAxis: (hover: number | null, x: (i: number) => number) => React.ReactNode;
  className?: string;
  'aria-label': string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  // An empty period (`ticks={[0]}`, every value 0) still draws its zero line.
  const top = Math.max(1, ticks[ticks.length - 1] ?? Math.max(...points.flatMap((p) => Object.values(p.values))));
  const x = (i: number) => (points.length < 2 ? 50 : (i / (points.length - 1)) * 100);
  const y = (v: number) => 100 - (Math.min(v, top) / top) * 100;
  const hovered = hover === null ? null : points[hover];
  const tickColumn = (
    <div aria-hidden className="relative" style={{ height }}>
      {ticks.map((t) => (
        <span
          key={t}
          className={cn(
            'figures absolute translate-y-1/2 text-[11px] text-fg-subtle',
            tickSide === 'left' ? 'right-0' : 'left-0',
          )}
          // biome-ignore lint/style/noInlineStyles: the label sits at its value.
          style={{ bottom: `${(t / top) * 100}%` }}
        >
          {format(t)}
        </span>
      ))}
    </div>
  );
  return (
    <figure data-slot={slot} className={cn('m-0 flex min-w-0 flex-col gap-2', className)} aria-label={ariaLabel}>
      <ChartReadout series={series} label={hovered?.label} values={hovered?.values} format={format} />
      <div
        className={cn(
          'grid gap-x-2.5',
          tickSide === 'left' ? 'grid-cols-[34px_minmax(0,1fr)] gap-x-2' : 'grid-cols-[minmax(0,1fr)_34px]',
        )}
      >
        {tickSide === 'left' ? tickColumn : null}
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
              <g key={s.key}>{draw(s, points.map((p, i) => [x(i), y(p.values[s.key] ?? 0)] as const))}</g>
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
                  className={cn('pointer-events-none absolute -mb-[4.5px] -ml-[4.5px] size-[9px] rounded-pill shadow-[0_0_0_2px_var(--card)]', TONE_BG[s.tone])}
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
        {tickSide === 'right' ? tickColumn : null}
      </div>
      {xAxis(hover, x)}
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

function linePath(at: readonly (readonly [number, number])[]) {
  return at.map(([px, py], i) => `${i ? 'L' : 'M'}${px} ${py}`).join(' ');
}

function SeriesLine({ d, tone }: { d: string; tone: DataTone }) {
  return (
    <path
      d={d}
      fill="none"
      stroke={TONE_STROKE[tone]}
      strokeWidth={2}
      vectorEffect="non-scaling-stroke"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
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
  return (
    <TimeSeries
      slot="line-chart"
      series={series}
      points={points}
      ticks={ticks}
      height={height}
      format={format}
      tickSide="right"
      draw={(s, at) => <SeriesLine d={linePath(at)} tone={s.tone} />}
      xAxis={() =>
        from || to ? (
          <div aria-hidden className="flex justify-between pr-11 text-[11px] text-fg-subtle">
            <span>{from}</span>
            <span>{to}</span>
          </div>
        ) : null
      }
      className={className}
      aria-label={ariaLabel}
    />
  );
}

/**
 * AreaChart — a quantity over time where the volume is the point (Plan's
 * Stats: tokens and cost per week, tasks done). A monotone curve per series
 * over a wash of its tone (12% alone, 8% when series overlap), the ticks on
 * the left in a 34px column, a label under every point, and the same
 * crosshair, dots and readout as `LineChart`. A comparison of two rates
 * without volume stays a `LineChart`.
 */
function AreaChart({
  series,
  points,
  ticks,
  height = 200,
  format = plain,
  area = true,
  className,
  'aria-label': ariaLabel,
}: {
  series: readonly ChartSeries[];
  points: readonly LinePoint[];
  /** Y values to rule and label, ascending; the last is the top. */
  ticks: readonly number[];
  height?: number;
  format?: (value: number) => string;
  /** The wash under each curve; off leaves the curves alone. */
  area?: boolean;
  className?: string;
  'aria-label': string;
}) {
  const wash = series.length > 1 ? 0.08 : 0.12;
  return (
    <TimeSeries
      slot="area-chart"
      series={series}
      points={points}
      ticks={ticks}
      height={height}
      format={format}
      tickSide="left"
      draw={(s, at) => {
        const line = monotonePath(at);
        const first = at[0];
        const last = at[at.length - 1];
        return (
          <>
            {area && first && last && at.length > 1 ? (
              <path d={`${line} L${last[0]} 100 L${first[0]} 100 Z`} fill={TONE_STROKE[s.tone]} opacity={wash} />
            ) : null}
            <SeriesLine d={line} tone={s.tone} />
          </>
        );
      }}
      xAxis={(hover, x) => (
        <div aria-hidden className="relative ml-10.5 h-4">
          {points.map((p, i) => (
            <span
              key={p.label}
              className={cn(
                'figures absolute -translate-x-1/2 text-[11px] whitespace-nowrap text-fg-subtle',
                hover === i && 'text-fg',
              )}
              // biome-ignore lint/style/noInlineStyles: the label sits under its point.
              style={{ left: `${x(i)}%` }}
            >
              {p.label}
            </span>
          ))}
        </div>
      )}
      className={className}
      aria-label={ariaLabel}
    />
  );
}

function RingChart({
  segments,
  label,
  value,
  size = 148,
  className,
}: {
  segments: readonly { key: string; label: string; value: number; tone: DataTone }[];
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
              stroke={TONE_STROKE[s.tone]}
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
  tone?: DataTone;
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
          <StatBar track segments={[{ share: row.share, tone: 'chart-1' }]} />
          {row.detail ? <span className="text-xs text-fg-muted">{row.detail}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export { AreaChart, BarChart, BarList, ChartHero, ChartLegend, ChartRow, LineChart, RingChart };
export type { BarDatum, ChartSeries, LinePoint };
export type { DataTone };
