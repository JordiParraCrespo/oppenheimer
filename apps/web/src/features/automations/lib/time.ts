import { dateFormatter } from '@oppenheimer/frontend-web';
import { wallTimeAt } from '@oppenheimer/shared/automations';

/**
 * Time as the automations pages print it. Every instant arrives in UTC and is
 * shown in the viewer's zone; the only wall times that are not the viewer's
 * are a schedule's own, which it keeps in the zone it was set in.
 */

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const pad2 = (value: number) => String(value).padStart(2, '0');

/** The viewer's IANA zone, which the history chart's days and a new schedule use. */
export function viewerTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** "08:30", 24-hour, in the viewer's zone (or the one given). */
export function clock(at: Date, timeZone = viewerTimeZone()): string {
  const wall = wallTimeAt(at.getTime(), timeZone);
  return `${pad2(wall.hour)}:${pad2(wall.minute)}`;
}

/** "08:30" from a schedule's own wall fields. */
export function wallClock(hour: number, minute: number): string {
  return `${pad2(hour)}:${pad2(minute)}`;
}

export { pad2 };

/** "Sep 28": the runs list's date column and the chart's axis. */
export function monthDay(at: Date, locale: string, timeZone = viewerTimeZone()): string {
  return dateFormatter(locale, { month: 'short', day: 'numeric', timeZone }).format(at);
}

/** "Mon 28 Sep": a day that is neither today nor tomorrow. */
export function weekdayDate(at: Date, locale: string, timeZone = viewerTimeZone()): string {
  return dateFormatter(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone,
  }).format(at);
}

/** The `YYYY-MM-DD` local date of an instant in a zone. */
export function localDate(at: number, timeZone: string): string {
  const wall = wallTimeAt(at, timeZone);
  return `${wall.year}-${pad2(wall.month)}-${pad2(wall.day)}`;
}

/** Whole local days from `now`'s date to `at`'s: 0 today, 1 tomorrow, -1 yesterday. */
export function dayOffset(at: number, now: number, timeZone: string): number {
  const toUtcMidnight = (instant: number) => {
    const wall = wallTimeAt(instant, timeZone);
    return Date.UTC(wall.year, wall.month - 1, wall.day);
  };
  return Math.round((toUtcMidnight(at) - toUtcMidnight(now)) / DAY);
}
