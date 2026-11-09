import type { LinePoint } from '@oppenheimer/design-system-web';

/** Five ruled values from 0 to a round top at or above `max`: 1, 2 or 5 times a power of ten per step, never under 1. */
export function niceTicks(max: number): number[] {
  const raw = Math.max(max, 4) / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 5, 10].find((m) => m * power >= raw) ?? 10) * power;
  return [0, 1, 2, 3, 4].map((i) => i * step);
}

export type ChangeTone = 'good' | 'bad' | 'flat';

/**
 * The change from the period before as a signed percentage, and whether it
 * went the good way; none when either side is missing or the period before
 * had nothing to compare with.
 */
export function changeOf(
  current: number | null,
  previous: number | null | undefined,
  higherIsBetter: boolean | null,
): { value: string; tone: ChangeTone } | null {
  if (current === null || previous === null || previous === undefined || previous === 0)
    return null;
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0 || higherIsBetter === null) {
    return {
      value: `${change > 0 ? '+' : change < 0 ? '−' : ''}${Math.abs(change)}%`,
      tone: 'flat',
    };
  }
  const better = higherIsBetter ? change > 0 : change < 0;
  return { value: `${change > 0 ? '+' : '−'}${Math.abs(change)}%`, tone: better ? 'good' : 'bad' };
}

/** The busiest week across a chart's series, for its ticks. */
export function peakOf(series: Readonly<Record<string, readonly number[]>>): number {
  return Math.max(0, ...Object.values(series).flat());
}

/** A weekly chart's points: each week's label with every series' value that week (0 when it has none). */
export function weeklyPoints(
  labels: readonly string[],
  series: Readonly<Record<string, readonly number[]>>,
): LinePoint[] {
  return labels.map((label, i) => ({
    label,
    values: Object.fromEntries(
      Object.entries(series).map(([key, values]) => [key, values[i] ?? 0]),
    ),
  }));
}
