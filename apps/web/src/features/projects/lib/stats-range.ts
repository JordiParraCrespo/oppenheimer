import { addDays } from '@oppenheimer/frontend-web';
import { PLAN_STATS_MAX_DAYS, planStatsDays } from '@oppenheimer/shared/schemas/plan-stats';
import { calendarDateSchema } from '@oppenheimer/shared/schemas/task';
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

/**
 * The range the address names, or the last eight weeks when it names none,
 * a day that does not exist, a backwards one, or one longer than the API
 * reports on (a custom pick or a hand-edited link), so the read never asks
 * for a period it would refuse.
 */
export function statsRangeOf(
  search: Pick<ProjectPageSearch, 'from' | 'to'>,
  today: string,
): StatsRange {
  const { from, to } = search;
  const real = (day: string | undefined): day is string =>
    calendarDateSchema.safeParse(day).success;
  if (real(from) && real(to) && from <= to && planStatsDays(from, to) <= PLAN_STATS_MAX_DAYS) {
    return { from, to };
  }
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
