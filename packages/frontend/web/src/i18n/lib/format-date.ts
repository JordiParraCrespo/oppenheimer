/**
 * Date formatting shared by the workspace screens. Everything goes through
 * `Intl`, so the reader's locale decides the wording and the order — nothing
 * here needs a translation key.
 */

/** "Jun 2026" — how a join date is written on a profile card. */
export function formatMonthYear(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** Anything inside this window reads as "right now" rather than "0 minutes ago". */
const JUST_NOW_MS = 60_000;

const DIVISIONS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.34524],
  ['month', 12],
  ['year', Number.POSITIVE_INFINITY],
];

/**
 * "2 hours ago", in the reader's language.
 *
 * Returns `null` for anything within the last minute so the caller can say
 * "Active now" in its own words — a session list wants presence, not a
 * stopwatch.
 */
export function formatRelativeTime(date: Date, locale: string, now = new Date()): string | null {
  const elapsedMs = date.getTime() - now.getTime();
  if (Math.abs(elapsedMs) < JUST_NOW_MS) return null;

  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  let amount = elapsedMs / 1000;
  for (const [unit, size] of DIVISIONS) {
    if (Math.abs(amount) < size) return formatter.format(Math.round(amount), unit);
    amount /= size;
  }

  // Unreachable: the last division has no ceiling.
  return formatter.format(Math.round(amount), 'year');
}

/**
 * The age of something, as a unit and a count — "2 hours old" as
 * `{ unit: 'hour', count: 2 }`.
 *
 * Returns the pieces rather than a string because the compact rendering the
 * product wants ("2h", "3d") is not one `Intl.RelativeTimeFormat` produces:
 * its `narrow` style still says "2 hr. ago". The words live in
 * `common.relative.*` instead, so the caller translates and this stays pure
 * date arithmetic. `null` means "less than a minute", which the caller words
 * itself — a thread list says "now", a session list says "Active now".
 */
export function compactAge(
  date: Date,
  now = new Date(),
): {
  unit: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
  count: number;
} | null {
  const seconds = Math.max(0, (now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return null;

  const minutes = seconds / 60;
  if (minutes < 60) return { unit: 'minute', count: Math.floor(minutes) };

  const hours = minutes / 60;
  if (hours < 24) return { unit: 'hour', count: Math.floor(hours) };

  const days = hours / 24;
  if (days < 7) return { unit: 'day', count: Math.floor(days) };

  const weeks = days / 7;
  if (weeks < 4.34524) return { unit: 'week', count: Math.floor(weeks) };

  const months = days / 30.4375;
  if (months < 12) return { unit: 'month', count: Math.floor(months) };

  return { unit: 'year', count: Math.floor(days / 365.25) };
}

/**
 * `Intl.DateTimeFormat` is expensive to construct and the tables were building
 * one per row. Formatters are pure for a given (locale, options), so they are
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

/** "Jun 12" — a day inside the current year, as the tables and charts write it. */
export function formatShortDate(date: Date, locale: string): string {
  return dateFormatter(locale, { month: 'short', day: 'numeric' }).format(date);
}

/** "12 Jun 2026" — a date that needs its year, in the reader's order. */
export function formatMediumDate(date: Date, locale: string): string {
  return dateFormatter(locale, { dateStyle: 'medium' }).format(date);
}

const DAY_MS = 86_400_000;

/**
 * The timestamp beside a message in a mailbox: the clock time for today, the
 * word for yesterday, the weekday for the rest of the week, then the date.
 *
 * Every branch resolves through `Intl`, including "yesterday" — which
 * `RelativeTimeFormat` writes in the reader's language with `numeric: 'auto'`
 * — so a mail list needs no translation keys of its own.
 */
export function formatMessageTime(date: Date, locale: string, now = new Date()): string {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const time = date.getTime();

  if (time >= startOfToday) {
    return dateFormatter(locale, { hour: 'numeric', minute: '2-digit' }).format(date);
  }
  if (time >= startOfToday - DAY_MS) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-1, 'day');
  }
  // Inside the last week a weekday is the most readable thing a row can say —
  // "Mon" places a message without the reader doing arithmetic on a date.
  if (time >= startOfToday - 6 * DAY_MS) {
    return dateFormatter(locale, { weekday: 'short' }).format(date);
  }
  if (date.getFullYear() !== now.getFullYear()) {
    return dateFormatter(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }
  return formatShortDate(date, locale);
}

/** "12 Jun 2026, 14:30" — the stamp on a session, a token or an audit entry. */
export function formatDateTime(date: Date, locale: string): string {
  return dateFormatter(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
