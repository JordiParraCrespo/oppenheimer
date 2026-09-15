import type { DayBucket, FormatOptions, RelativeParts, ValueFormat } from './types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/**
 * Locale- and timezone-aware value formatting, built on `Intl`.
 *
 * Everything a notification shows that is not a plain string goes through
 * here: money, counts, dates and relative times. The point of centralizing it
 * is that "€31,400.00" and "31.400,00 €" are the *same* stored value — the
 * difference is entirely the reader's, and no call site should be deciding it.
 *
 * Formatter instances are cached per (locale, options) because constructing an
 * `Intl.NumberFormat` is the expensive part and a feed page formats dozens of
 * values through the same handful of configurations.
 */
export class Formatter {
  private readonly numberFormats = new Map<string, Intl.NumberFormat>();
  private readonly dateFormats = new Map<string, Intl.DateTimeFormat>();
  private readonly relativeFormats = new Map<string, Intl.RelativeTimeFormat>();

  /**
   * Format by name, as a declaration's fact table asks for it.
   *
   * Unknown formats fall through to `text` rather than throwing: a fact that
   * renders as a plain number is a cosmetic defect, and taking the page down
   * over one is not a trade worth making at read time. `defineNotificationType`
   * rejects unknown formats at boot, which is where that mistake belongs.
   */
  format(
    locale: string,
    value: unknown,
    format: ValueFormat = 'text',
    options: FormatOptions = {},
  ): string {
    if (value === null || value === undefined) return '';

    switch (format) {
      case 'currency':
        return this.currency(locale, Number(value), options.currency ?? 'EUR');
      case 'number':
        return this.number(locale, Number(value));
      case 'percent':
        return this.percent(locale, Number(value));
      case 'date':
        return this.date(locale, this.toDate(value), options.timeZone);
      case 'datetime':
        return this.dateTime(locale, this.toDate(value), options.timeZone);
      case 'relative':
        return this.relative(locale, this.toDate(value), options.now);
      default:
        return String(value);
    }
  }

  /**
   * Money, from **minor units**. The database stores 3140000 and the reader
   * sees €31,400.00 — nothing between the two ever holds a float.
   */
  currency(locale: string, minorUnits: number, currency: string): string {
    const formatter = this.numberFormat(locale, {
      style: 'currency',
      currency,
    });
    return formatter.format(minorUnits / 100);
  }

  number(locale: string, value: number): string {
    return this.numberFormat(locale, {}).format(value);
  }

  /** `value` is a ratio: `0.38` renders as `38%`. */
  percent(locale: string, value: number): string {
    return this.numberFormat(locale, {
      style: 'percent',
      maximumFractionDigits: 1,
    }).format(value);
  }

  /** A signed ratio, for deltas like a `−38%` impressions drop. */
  percentDelta(locale: string, value: number): string {
    return this.numberFormat(locale, {
      style: 'percent',
      maximumFractionDigits: 1,
      signDisplay: 'exceptZero',
    }).format(value);
  }

  date(locale: string, value: Date, timeZone = 'UTC'): string {
    return this.dateFormat(locale, { dateStyle: 'medium', timeZone }).format(value);
  }

  dateTime(locale: string, value: Date, timeZone = 'UTC'): string {
    return this.dateFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone,
    }).format(value);
  }

  /** Long form — "2 hours ago" / "hace 2 horas" — for body copy. */
  relative(locale: string, value: Date, now: Date = new Date()): string {
    const { unit, count } = this.relativeParts(value, now);
    if (unit === 'now') return this.relativeFormat(locale).format(0, 'second');
    return this.relativeFormat(locale).format(-count, unit);
  }

  /**
   * The unit and count behind a relative time, without the words.
   *
   * The compact list-column label (`12m`, `2h`, `1d`) is a *translation*, not a
   * calculation — Spanish may well want `12min` — so the caller pairs these
   * parts with a copy key instead of receiving a pre-built string.
   */
  relativeParts(value: Date, now: Date = new Date()): RelativeParts {
    const elapsed = Math.max(0, now.getTime() - value.getTime());

    if (elapsed < MINUTE) return { unit: 'now', count: 0 };
    if (elapsed < HOUR) return { unit: 'minute', count: Math.floor(elapsed / MINUTE) };
    if (elapsed < DAY) return { unit: 'hour', count: Math.floor(elapsed / HOUR) };
    if (elapsed < WEEK) return { unit: 'day', count: Math.floor(elapsed / DAY) };
    if (elapsed < MONTH) return { unit: 'week', count: Math.floor(elapsed / WEEK) };
    if (elapsed < YEAR) return { unit: 'month', count: Math.floor(elapsed / MONTH) };
    return { unit: 'year', count: Math.floor(elapsed / YEAR) };
  }

  /**
   * Which day-heading a notification belongs under, **in the reader's zone**.
   *
   * A notification created at 23:30 in Madrid is "today" to a Madrid reader and
   * "yesterday" to a UTC one. Computing this on the server, from the resolved
   * timezone, is what stops the client re-deriving date boundaries it does not
   * have the timezone to get right.
   */
  dayBucket(value: Date, now: Date = new Date(), timeZone = 'UTC'): DayBucket {
    const day = this.isoDay(value, timeZone);
    if (day === this.isoDay(now, timeZone)) return 'today';
    if (day === this.isoDay(new Date(now.getTime() - DAY), timeZone)) return 'yesterday';
    return 'earlier';
  }

  /** `YYYY-MM-DD` for an instant as seen in `timeZone`. */
  isoDay(value: Date, timeZone = 'UTC'): string {
    const parts = this.dateFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone,
    }).format(value);
    // en-CA renders ISO-ordered dates, so this is already `YYYY-MM-DD`.
    return parts;
  }

  private toDate(value: unknown): Date {
    if (value instanceof Date) return value;
    return new Date(String(value));
  }

  private numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
    const key = `${locale}:${JSON.stringify(options)}`;
    const cached = this.numberFormats.get(key);
    if (cached) return cached;
    const created = new Intl.NumberFormat(locale, options);
    this.numberFormats.set(key, created);
    return created;
  }

  private dateFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    const key = `${locale}:${JSON.stringify(options)}`;
    const cached = this.dateFormats.get(key);
    if (cached) return cached;
    const created = new Intl.DateTimeFormat(locale, options);
    this.dateFormats.set(key, created);
    return created;
  }

  private relativeFormat(locale: string): Intl.RelativeTimeFormat {
    const cached = this.relativeFormats.get(locale);
    if (cached) return cached;
    const created = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    this.relativeFormats.set(locale, created);
    return created;
  }
}
