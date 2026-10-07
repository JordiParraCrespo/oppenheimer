import type { BarDatum, ChartSeries, DataTone } from '@oppenheimer/design-system-web';
import type { PullRequestAnalytics, PullRequestLane } from '@oppenheimer/frontend-consumer';

export const DAY_SERIES = (created: string, merged: string): ChartSeries[] => [
  { key: 'created', label: created, tone: 'chart-1' },
  { key: 'merged', label: merged, tone: 'chart-2' },
];

export const LANE_TONE: Record<PullRequestLane, DataTone> = {
  quick: 'chart-1',
  medium: 'chart-2',
  deep: 'chart-3',
};

/** One bar per day: the day of the month, with the month under the first bar of each. */
export function dayBars(
  analytics: PullRequestAnalytics,
  locale: string,
  weekOf?: (date: string) => string,
): BarDatum[] {
  return analytics.days.map((day, index) => {
    const date = new Date(`${day.date}T00:00:00Z`);
    const before = index === 0 ? null : analytics.days[index - 1];
    // A month's name sits under the first bar that falls in it, whether the
    // bars are days or weeks. Asking whether the day of the month is 1 — or,
    // for a week bar, 1 to 7 — labelled a quarter of the week bars and made
    // the chart's own label ceiling impossible to keep.
    const startsMonth =
      before === null || new Date(`${before.date}T00:00:00Z`).getUTCMonth() !== date.getUTCMonth();
    return {
      key: day.date,
      label: String(date.getUTCDate()),
      sublabel: startsMonth
        ? date.toLocaleString(locale, { month: 'short', timeZone: 'UTC' })
        : undefined,
      // A week's bar says which week it is, rather than the day it starts on.
      readoutLabel:
        analytics.bucket === 'week' && weekOf
          ? weekOf(
              date.toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }),
            )
          : undefined,
      values: { created: day.created, merged: day.merged },
    };
  });
}

/** `Sep 5 – Oct 4`. */
export function rangeLabel(analytics: PullRequestAnalytics, locale: string): string {
  const format = (at: string) =>
    new Date(at).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  return `${format(analytics.from)} – ${format(analytics.to)}`;
}

export function shareOf(value: number, total: number): number {
  return total ? Math.round((value / total) * 100) : 0;
}
