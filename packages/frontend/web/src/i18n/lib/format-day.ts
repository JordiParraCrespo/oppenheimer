import { dateFormatter } from './format-date';

/**
 * A calendar day (`YYYY-MM-DD`) has no timezone: it is formatted as the UTC
 * midnight it is, in UTC, so no reader's offset moves it to the day before.
 */
function utcMidnight(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

const STYLES = {
  /** "Oct 7" */
  short: { month: 'short', day: 'numeric', timeZone: 'UTC' },
  /** "Tue, Oct 6" */
  long: { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' },
  /** "Tue, Oct 6, 2027", for a day outside this year. */
  longWithYear: {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

/** A due date, a target, an event's day, in the reader's language. */
export function formatCalendarDay(
  iso: string,
  locale: string,
  style: keyof typeof STYLES = 'short',
): string {
  return dateFormatter(locale, STYLES[style]).format(utcMidnight(iso));
}

/** "October 2026", for a `YYYY-MM`. */
export function formatCalendarMonth(month: string, locale: string): string {
  return dateFormatter(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    utcMidnight(`${month}-01`),
  );
}

/** The seven weekday names, Monday first, in the reader's language. */
export function weekdayNames(locale: string, width: 'narrow' | 'short' = 'short'): string[] {
  const format = dateFormatter(locale, { weekday: width, timeZone: 'UTC' });
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, day) => format.format(new Date(Date.UTC(2024, 0, 1 + day))));
}

/** `today`, `tomorrow` or `yesterday` for a day next to `today`, so a caller can say it in words. */
export function nearDay(iso: string, today: string): 'today' | 'tomorrow' | 'yesterday' | null {
  const days = Math.round((utcMidnight(iso).getTime() - utcMidnight(today).getTime()) / 86_400_000);
  return days === 0 ? 'today' : days === 1 ? 'tomorrow' : days === -1 ? 'yesterday' : null;
}
