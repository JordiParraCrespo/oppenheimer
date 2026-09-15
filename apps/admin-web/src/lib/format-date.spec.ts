import { describe, expect, it } from 'vitest';
import {
  compactAge,
  dateFormatter,
  formatDateTime,
  formatMediumDate,
  formatMessageTime,
  formatMonthYear,
  formatRelativeTime,
  formatShortDate,
} from './format-date';

/**
 * Everything here resolves through `Intl`, so these tests deliberately avoid
 * asserting exact wording where the runtime's CLDR data decides it — a test
 * that pins "2 hours ago" breaks on a Node upgrade for no reason. What is
 * asserted is the arithmetic and the branch chosen: which unit, which
 * threshold, which of the five shapes `formatMessageTime` can return.
 *
 * `now` is passed explicitly everywhere it is accepted, so nothing here depends
 * on the wall clock.
 */

const NOW = new Date('2026-06-15T14:30:00.000Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatMonthYear', () => {
  it('writes a month and year', () => {
    expect(formatMonthYear(new Date('2026-06-15T00:00:00Z'), 'en-GB')).toBe('Jun 2026');
  });

  it('follows the reader’s locale', () => {
    expect(formatMonthYear(new Date('2026-06-15T00:00:00Z'), 'es-ES')).toContain('2026');
    expect(formatMonthYear(new Date('2026-06-15T00:00:00Z'), 'es-ES')).not.toBe('Jun 2026');
  });
});

describe('formatRelativeTime', () => {
  it('returns null inside the just-now window so the caller can say "now"', () => {
    // A session list wants presence, not a stopwatch reading "0 minutes ago".
    expect(formatRelativeTime(ago(30 * SECOND), 'en', NOW)).toBeNull();
    expect(formatRelativeTime(NOW, 'en', NOW)).toBeNull();
  });

  it('returns null for a near-future timestamp too', () => {
    // Clock skew between the server and the browser routinely produces a
    // timestamp a few seconds ahead. "in 12 seconds" is a bug report.
    expect(formatRelativeTime(new Date(NOW.getTime() + 30 * SECOND), 'en', NOW)).toBeNull();
  });

  it('crosses out of the window at one minute', () => {
    expect(formatRelativeTime(ago(MINUTE), 'en', NOW)).not.toBeNull();
  });

  it.each([
    [2 * MINUTE, -2, 'minute'],
    [3 * HOUR, -3, 'hour'],
    [3 * DAY, -3, 'day'],
    [3 * 7 * DAY, -3, 'week'],
    [90 * DAY, -3, 'month'],
    [500 * DAY, -1, 'year'],
  ] as const)('reduces %ims to %i %s', (elapsed, value, unit) => {
    // Compared against `Intl`'s own output for the expected (value, unit)
    // pair rather than a literal string: what this function decides is which
    // division to stop at, and pinning "3 hours ago" would break on a CLDR
    // update that has nothing to do with the arithmetic.
    const expected = new Intl.RelativeTimeFormat('en', {
      numeric: 'auto',
    }).format(value, unit);

    expect(formatRelativeTime(ago(elapsed), 'en', NOW)).toBe(expected);
  });

  it('words a future time as future', () => {
    const future = new Date(NOW.getTime() + 3 * HOUR);

    expect(formatRelativeTime(future, 'en', NOW)).toMatch(/^in /);
  });

  it('words a past time as past', () => {
    expect(formatRelativeTime(ago(3 * HOUR), 'en', NOW)).toMatch(/ago$/);
  });

  it('translates with the locale', () => {
    expect(formatRelativeTime(ago(3 * HOUR), 'es', NOW)).not.toBe(
      formatRelativeTime(ago(3 * HOUR), 'en', NOW),
    );
  });
});

describe('compactAge', () => {
  it('returns null under a minute', () => {
    expect(compactAge(ago(59 * SECOND), NOW)).toBeNull();
  });

  it.each([
    [MINUTE, { unit: 'minute', count: 1 }],
    [59 * MINUTE, { unit: 'minute', count: 59 }],
    [HOUR, { unit: 'hour', count: 1 }],
    [23 * HOUR, { unit: 'hour', count: 23 }],
    [DAY, { unit: 'day', count: 1 }],
    [6 * DAY, { unit: 'day', count: 6 }],
    [7 * DAY, { unit: 'week', count: 1 }],
    [40 * DAY, { unit: 'month', count: 1 }],
    [400 * DAY, { unit: 'year', count: 1 }],
  ])('reports %ims as its coarsest whole unit', (elapsed, expected) => {
    expect(compactAge(ago(elapsed), NOW)).toEqual(expected);
  });

  it('floors rather than rounds', () => {
    // "2h" must mean at least two hours have passed. Rounding up would show a
    // message posted 91 minutes ago as two hours old.
    expect(compactAge(ago(91 * MINUTE), NOW)).toEqual({
      unit: 'hour',
      count: 1,
    });
  });

  it('clamps a future timestamp to null rather than reporting a negative age', () => {
    // Clock skew again. `Math.max(0, …)` is what keeps this from rendering
    // "-1 minutes".
    expect(compactAge(new Date(NOW.getTime() + HOUR), NOW)).toBeNull();
  });

  it('crosses each boundary exactly once', () => {
    expect(compactAge(ago(60 * SECOND - 1), NOW)).toBeNull();
    expect(compactAge(ago(60 * SECOND), NOW)?.unit).toBe('minute');
    expect(compactAge(ago(60 * MINUTE - 1), NOW)?.unit).toBe('minute');
    expect(compactAge(ago(60 * MINUTE), NOW)?.unit).toBe('hour');
  });
});

describe('dateFormatter', () => {
  it('returns the same instance for the same locale and options', () => {
    // The tables were constructing one formatter per row. The cache is the fix,
    // and identity is the only way to assert it is working.
    const options = { month: 'short', day: 'numeric' } as const;

    expect(dateFormatter('en-GB', options)).toBe(dateFormatter('en-GB', options));
  });

  it('keys the cache on the locale', () => {
    const options = { month: 'short', day: 'numeric' } as const;

    expect(dateFormatter('en-GB', options)).not.toBe(dateFormatter('es-ES', options));
  });

  it('keys the cache on the options', () => {
    expect(dateFormatter('en-GB', { dateStyle: 'medium' })).not.toBe(
      dateFormatter('en-GB', { dateStyle: 'full' }),
    );
  });
});

describe('formatShortDate / formatMediumDate / formatDateTime', () => {
  const date = new Date('2026-06-12T14:30:00.000Z');

  it('writes a day and month without a year', () => {
    expect(formatShortDate(date, 'en-GB')).toBe('12 Jun');
  });

  it('writes a medium date with its year', () => {
    expect(formatMediumDate(date, 'en-GB')).toContain('2026');
  });

  it('writes a date and a time together', () => {
    const formatted = formatDateTime(date, 'en-GB');

    expect(formatted).toContain('2026');
    expect(formatted).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('formatMessageTime', () => {
  // Built from local-time parts so the "start of today" boundary is computed
  // the same way the implementation computes it, whatever the runner's zone.
  const at = (day: number, hour: number, minute = 0) => new Date(2026, 5, day, hour, minute, 0, 0);
  const now = at(15, 14, 30);

  it('shows a clock time for today', () => {
    expect(formatMessageTime(at(15, 9, 5), 'en-GB', now)).toMatch(/\d{1,2}:\d{2}/);
  });

  it('shows a clock time for the first moment of today', () => {
    expect(formatMessageTime(at(15, 0, 0), 'en-GB', now)).toMatch(/\d{1,2}:\d{2}/);
  });

  it('says "yesterday" in the reader’s language', () => {
    expect(formatMessageTime(at(14, 23), 'en-GB', now)).toBe('yesterday');
    expect(formatMessageTime(at(14, 23), 'es-ES', now)).toBe('ayer');
  });

  it('shows a weekday for the rest of the week', () => {
    // "Mon" places a message without the reader doing arithmetic on a date.
    expect(formatMessageTime(at(11, 10), 'en-GB', now)).toMatch(/^[A-Z][a-z]{2}$/);
  });

  it('falls back to a day and month once the week is out', () => {
    expect(formatMessageTime(at(1, 10), 'en-GB', now)).toBe('1 Jun');
  });

  it('includes the year for a message from another year', () => {
    expect(formatMessageTime(new Date(2025, 11, 20, 10, 0), 'en-GB', now)).toContain('2025');
  });

  it('does not treat a January message as "this week" in a new year', () => {
    // The week check runs before the year check, so a date six days back that
    // crosses New Year must still be reachable by the weekday branch — and one
    // further back must show its year rather than a bare day and month.
    const january = new Date(2026, 0, 2, 10, 0);
    const newYear = new Date(2026, 0, 5, 14, 30);

    expect(formatMessageTime(january, 'en-GB', newYear)).toMatch(/^[A-Z][a-z]{2}$/);
    expect(formatMessageTime(new Date(2025, 11, 20, 10, 0), 'en-GB', newYear)).toContain('2025');
  });
});
