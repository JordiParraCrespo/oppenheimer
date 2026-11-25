import { wallTimeAt } from '@oppenheimer/shared/automations';

const DAY = 24 * 60 * 60_000;
const pad2 = (value: number) => String(value).padStart(2, '0');

/**
 * Date words both platforms' kits format the same way: `Intl` alone, no DOM.
 * The web kit re-exports them from its `i18n` concern.
 */

/**
 * `Intl.DateTimeFormat` is expensive to construct and a table formats a date
 * per row. Formatters are pure for a given (locale, options), so they are
 * cached here and every helper below goes through this.
 */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

export function dateFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    formatterCache.set(key, formatter);
  }
  return formatter;
}

/** The viewer's IANA zone: where an instant is read, and the zone a new schedule takes. */
export function viewerTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** "08:30" from a schedule's own wall fields, 24-hour. */
export function wallClock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
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

/** "08:30", 24-hour, in the viewer's zone (or the one given). */
export function clock(at: Date, timeZone = viewerTimeZone()): string {
  const wall = wallTimeAt(at.getTime(), timeZone);
  return `${pad2(wall.hour)}:${pad2(wall.minute)}`;
}

/** Whole local days from `now`'s date to `at`'s: 0 today, 1 tomorrow, -1 yesterday. */
export function dayOffset(at: number, now: number, timeZone: string): number {
  const toUtcMidnight = (instant: number) => {
    const wall = wallTimeAt(instant, timeZone);
    return Date.UTC(wall.year, wall.month - 1, wall.day);
  };
  return Math.round((toUtcMidnight(at) - toUtcMidnight(now)) / DAY);
}
