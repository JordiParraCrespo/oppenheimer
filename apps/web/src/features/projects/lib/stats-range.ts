import { addDays } from '@oppenheimer/frontend-web';
import type { ProjectPageSearch } from './project-page-search';

/** The ranges Stats offers by name, in weeks ending today. */
export const STATS_PRESETS = [
  { id: 'w4', weeks: 4 },
  { id: 'w8', weeks: 8 },
  { id: 'w12', weeks: 12 },
  { id: 'w26', weeks: 26 },
] as const;

const DEFAULT_WEEKS = 8;

export interface StatsRange {
  from: string;
  to: string;
}

/** `weeks` whole weeks ending on `today`, both ends included. */
export function lastWeeks(weeks: number, today: string): StatsRange {
  return { from: addDays(today, -(weeks * 7 - 1)), to: today };
}

/** The range the address names, or the last eight weeks when it names none (or a backwards one). */
export function statsRangeOf(
  search: Pick<ProjectPageSearch, 'from' | 'to'>,
  today: string,
): StatsRange {
  if (search.from && search.to && search.from <= search.to)
    return { from: search.from, to: search.to };
  return lastWeeks(DEFAULT_WEEKS, today);
}

/** What the address says for a range: nothing for the default, so a plain link stays plain. */
export function statsRangeSearch(
  range: StatsRange,
  today: string,
): Pick<ProjectPageSearch, 'from' | 'to'> {
  const fallback = lastWeeks(DEFAULT_WEEKS, today);
  if (range.from === fallback.from && range.to === fallback.to)
    return { from: undefined, to: undefined };
  return range;
}

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
