import type { PullRequestAnalyticsRange } from '@oppenheimer/shared';

const DAY_MS = 86_400_000;

/**
 * The most closed pull requests one Analytics read takes in full, newest
 * first: what keeps a page view's cost bounded by the window rather than by
 * the installation (#247). Past it the answer says it is not complete.
 */
export const CLOSED_CEILING = 150;
const RANGE_DAYS: Record<PullRequestAnalyticsRange, number> = { week: 7, month: 30, quarter: 90 };

/** The period on screen and the one before it, both ending on `now`'s side. */
export interface AnalyticsWindow {
  days: number;
  from: Date;
  to: Date;
  previousFrom: Date;
}

export function analyticsWindow(range: PullRequestAnalyticsRange, now: Date): AnalyticsWindow {
  const days = RANGE_DAYS[range];
  const to = now;
  const from = new Date(to.getTime() - days * DAY_MS);
  return { days, from, to, previousFrom: new Date(from.getTime() - days * DAY_MS) };
}

export type Period = 'current' | 'previous' | null;

export function periodOf(at: Date | string | null, window: AnalyticsWindow): Period {
  if (at === null) return null;
  const time = new Date(at).getTime();
  if (time >= window.from.getTime() && time <= window.to.getTime()) return 'current';
  if (time >= window.previousFrom.getTime() && time < window.from.getTime()) return 'previous';
  return null;
}

/** The median, the measure the area reports instead of the mean: one stuck PR must not move it. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[middle] as number)
    : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

export function hoursBetween(from: Date | string, to: Date | string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / 3_600_000;
}

/** Each day of the window as `YYYY-MM-DD` in UTC, oldest first. */
export function daysOf(window: AnalyticsWindow): string[] {
  return Array.from({ length: window.days }, (_, index) =>
    new Date(window.from.getTime() + (index + 1) * DAY_MS).toISOString().slice(0, 10),
  );
}
