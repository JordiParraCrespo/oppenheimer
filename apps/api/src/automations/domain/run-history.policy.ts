import { wallTimeAt, zonedWallTimeToInstant } from '@oppenheimer/shared/automations';

/**
 * The history chart's days (the frames' "Run history · Last 30 days"): one
 * bar per **local** day of the viewer, today last, so the day boundaries are
 * where the person sees midnight, not UTC's.
 */
export interface HistoryWindow {
  /** The local calendar days, oldest first, `YYYY-MM-DD`. */
  days: string[];
  /** Midnight of the first day, as an instant: what the query reads from. */
  since: Date;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function historyWindow(now: Date, days: number, timezone: string): HistoryWindow {
  const today = wallTimeAt(now.getTime(), timezone);
  const list: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day) - offset * 86_400_000);
    list.push(`${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`);
  }
  const [year, month, day] = list[0].split('-').map(Number);
  return {
    days: list,
    since: new Date(zonedWallTimeToInstant({ year, month, day, hour: 0, minute: 0 }, timezone)),
  };
}

/** Every day of the window, with the counts the query found and zeroes for the rest. */
export function fillHistory(
  window: HistoryWindow,
  buckets: readonly { date: string; succeeded: number; failed: number }[],
): { date: string; succeeded: number; failed: number }[] {
  const byDay = new Map(buckets.map((bucket) => [bucket.date, bucket]));
  return window.days.map((date) => ({
    date,
    succeeded: byDay.get(date)?.succeeded ?? 0,
    failed: byDay.get(date)?.failed ?? 0,
  }));
}
