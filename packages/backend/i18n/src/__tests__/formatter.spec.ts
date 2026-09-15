import { describe, expect, it } from 'vitest';
import { Formatter } from '../formatter';

/** Non-breaking and narrow-no-break spaces vary by ICU build; normalize them. */
function normalize(value: string): string {
  return value.replace(/[\u00a0\u202f]/g, ' ');
}

describe('Formatter', () => {
  const formatter = new Formatter();

  describe('currency', () => {
    it('reads minor units and never touches a float', () => {
      expect(normalize(formatter.currency('en', 3_140_000, 'EUR'))).toBe('€31,400.00');
    });

    it('places the symbol where the locale puts it', () => {
      expect(normalize(formatter.currency('es', 3_140_000, 'EUR'))).toBe('31.400,00 €');
    });

    it('formats zero rather than rendering an empty cell', () => {
      expect(normalize(formatter.currency('en', 0, 'EUR'))).toBe('€0.00');
    });
  });

  describe('numbers', () => {
    it('groups digits per locale', () => {
      expect(normalize(formatter.number('en', 31400))).toBe('31,400');
      expect(normalize(formatter.number('es', 31400))).toBe('31.400');
    });

    it('renders a ratio as a percentage', () => {
      expect(normalize(formatter.percent('en', 0.38))).toBe('38%');
    });

    it('keeps the sign on a delta so a drop reads as a drop', () => {
      expect(normalize(formatter.percentDelta('en', -0.38))).toBe('-38%');
      expect(normalize(formatter.percentDelta('en', 0.12))).toBe('+12%');
    });
  });

  describe('relativeParts', () => {
    const now = new Date('2026-08-08T12:00:00Z');

    it.each([
      [new Date('2026-08-08T11:59:30Z'), 'now', 0],
      [new Date('2026-08-08T11:48:00Z'), 'minute', 12],
      [new Date('2026-08-08T10:00:00Z'), 'hour', 2],
      [new Date('2026-08-07T12:00:00Z'), 'day', 1],
      [new Date('2026-07-29T12:00:00Z'), 'week', 1],
      [new Date('2026-05-08T12:00:00Z'), 'month', 3],
      [new Date('2024-08-08T12:00:00Z'), 'year', 2],
    ])('decomposes %s into %s', (value, unit, count) => {
      expect(formatter.relativeParts(value as Date, now)).toEqual({
        unit,
        count,
      });
    });

    it('clamps a future timestamp to "now" instead of going negative', () => {
      expect(formatter.relativeParts(new Date('2026-08-08T13:00:00Z'), now)).toEqual({
        unit: 'now',
        count: 0,
      });
    });
  });

  describe('relative', () => {
    it('renders long form in the reader’s language', () => {
      const now = new Date('2026-08-08T12:00:00Z');
      expect(formatter.relative('en', new Date('2026-08-08T10:00:00Z'), now)).toBe('2 hours ago');
      expect(formatter.relative('es', new Date('2026-08-08T10:00:00Z'), now)).toBe('hace 2 horas');
    });
  });

  describe('dayBucket', () => {
    const now = new Date('2026-08-08T12:00:00Z');

    it('buckets by the reader’s calendar day', () => {
      expect(formatter.dayBucket(new Date('2026-08-08T01:00:00Z'), now, 'UTC')).toBe('today');
      expect(formatter.dayBucket(new Date('2026-08-07T23:00:00Z'), now, 'UTC')).toBe('yesterday');
      expect(formatter.dayBucket(new Date('2026-08-01T12:00:00Z'), now, 'UTC')).toBe('earlier');
    });

    it('moves a late-night notification across the boundary with the timezone', () => {
      // 23:30 UTC on the 7th is already the 8th in Madrid (UTC+2 in August).
      const lateNight = new Date('2026-08-07T23:30:00Z');
      expect(formatter.dayBucket(lateNight, now, 'UTC')).toBe('yesterday');
      expect(formatter.dayBucket(lateNight, now, 'Europe/Madrid')).toBe('today');
    });

    it('handles a zone behind UTC', () => {
      // 01:00 UTC on the 8th is still the 7th in Los Angeles.
      const earlyMorning = new Date('2026-08-08T01:00:00Z');
      expect(formatter.dayBucket(earlyMorning, now, 'UTC')).toBe('today');
      expect(formatter.dayBucket(earlyMorning, now, 'America/Los_Angeles')).toBe('yesterday');
    });
  });

  describe('dates', () => {
    it('formats in the requested zone, not the server’s', () => {
      const value = new Date('2026-08-07T23:30:00Z');
      expect(formatter.isoDay(value, 'UTC')).toBe('2026-08-07');
      expect(formatter.isoDay(value, 'Europe/Madrid')).toBe('2026-08-08');
    });

    it('orders date parts per locale', () => {
      const value = new Date('2026-07-30T10:00:00Z');
      expect(normalize(formatter.date('en', value, 'UTC'))).toBe('Jul 30, 2026');
      expect(normalize(formatter.date('es', value, 'UTC'))).toBe('30 jul 2026');
    });
  });

  describe('format', () => {
    it('dispatches by name', () => {
      expect(normalize(formatter.format('en', 3_140_000, 'currency', { currency: 'EUR' }))).toBe(
        '€31,400.00',
      );
      expect(formatter.format('en', 'plain', 'text')).toBe('plain');
    });

    it('renders null and undefined as an empty cell', () => {
      expect(formatter.format('en', null, 'currency')).toBe('');
      expect(formatter.format('en', undefined, 'text')).toBe('');
    });

    it('falls through to text for a format it does not know', () => {
      // Unknown formats are rejected at boot by defineNotificationType; at read
      // time degrading beats throwing.
      expect(formatter.format('en', 42, 'nonsense' as never)).toBe('42');
    });
  });
});
