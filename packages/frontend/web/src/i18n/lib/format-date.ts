import type { TFunction } from 'i18next';
import { formatShortDuration } from './format-duration';

/**
 * Date formatting shared by the workspace screens. Everything goes through
 * `Intl`, so the reader's locale decides the wording and the order — nothing
 * here needs a translation key.
 */

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

  const formatter = relativeFormatter(locale);

  let amount = elapsedMs / 1000;
  for (const [unit, size] of DIVISIONS) {
    if (Math.abs(amount) < size) return formatter.format(Math.round(amount), unit);
    amount /= size;
  }

  // Unreachable: the last division has no ceiling.
  return formatter.format(Math.round(amount), 'year');
}

/**
 * The age of something as a unit and a count: "2 hours old" is
 * `{ unit: 'hour', count: 2 }`.
 *
 * Pieces rather than a string because `Intl.RelativeTimeFormat` cannot say
 * "2h" (`narrow` still says "2 hr. ago"); the words live in `common.relative.*`
 * and the caller translates. `null` means "less than a minute", which the
 * caller words itself ("now", "Active now").
 *
 * `now` is required and should come from a ticking clock (`useNow`): read
 * during render, the React Compiler caches the age on `date` alone, and "5m"
 * stays "5m".
 */
export function compactAge(
  date: Date,
  now: Date | number,
): {
  unit: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
  count: number;
} | null {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const seconds = Math.max(0, (nowMs - date.getTime()) / 1000);
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
 * "5m", "3h", "2d" — how long ago, in the `common.relative.*` words that every
 * compact age uses (`formatShortDuration`) — and `common.relative.now` under a
 * minute.
 */
export function formatAge(date: Date, now: Date | number, t: TFunction): string {
  const ms = (typeof now === 'number' ? now : now.getTime()) - date.getTime();
  return ms < 60_000 ? t('common.relative.now') : formatShortDuration(ms, t);
}

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

const relativeCache = new Map<string, Intl.RelativeTimeFormat>();

/** One `Intl.RelativeTimeFormat` per locale, for the same reason. */
function relativeFormatter(locale: string): Intl.RelativeTimeFormat {
  let formatter = relativeCache.get(locale);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    relativeCache.set(locale, formatter);
  }
  return formatter;
}

/**
 * "12 Jun 2026" — a date that needs its year, in the reader's order.
 * Kept with no caller yet because `/scaffold-feature` names it for new screens.
 */
export function formatMediumDate(date: Date, locale: string): string {
  return dateFormatter(locale, { dateStyle: 'medium' }).format(date);
}

/**
 * "12 Jun 2026, 14:30" — the stamp on a session, a token or an audit entry.
 * Kept with no caller yet because `/scaffold-feature` names it for new screens.
 */
export function formatDateTime(date: Date, locale: string): string {
  return dateFormatter(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
