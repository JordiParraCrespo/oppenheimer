import { describe, expect, it } from 'vitest';
import {
  isValidTimeZone,
  nextScheduleOccurrence,
  type ScheduleRule,
  zonedWallTimeToInstant,
} from '../schedule.js';

const madrid = 'Europe/Madrid';

function rule(partial: Partial<ScheduleRule>): ScheduleRule {
  return { frequency: 'daily', hour: 9, minute: 0, timezone: madrid, ...partial };
}

describe('nextScheduleOccurrence', () => {
  it('fires daily at the wall time, whatever the offset of the season', () => {
    // Summer: CEST is UTC+2, so 09:00 is 07:00Z.
    expect(nextScheduleOccurrence(rule({}), new Date('2026-07-01T10:00:00Z'))?.toISOString()).toBe(
      '2026-07-02T07:00:00.000Z',
    );
    // Winter: CET is UTC+1, so 09:00 is 08:00Z.
    expect(nextScheduleOccurrence(rule({}), new Date('2026-12-01T10:00:00Z'))?.toISOString()).toBe(
      '2026-12-02T08:00:00.000Z',
    );
  });

  it('is strictly after the instant it is given, so a slot never fires twice', () => {
    const slot = new Date('2026-07-02T07:00:00.000Z');
    expect(nextScheduleOccurrence(rule({}), slot)?.toISOString()).toBe('2026-07-03T07:00:00.000Z');
  });

  it('skips weekends for weekdays', () => {
    // Friday 2026-09-25 after 09:00 local → Monday 28th.
    const next = nextScheduleOccurrence(
      rule({ frequency: 'weekdays', hour: 8, minute: 30 }),
      new Date('2026-09-25T09:00:00Z'),
    );
    expect(next?.toISOString()).toBe('2026-09-28T06:30:00.000Z');
  });

  it('fires weekly on the chosen days only', () => {
    const next = nextScheduleOccurrence(
      rule({ frequency: 'weekly', days: [1, 3], hour: 9, minute: 0 }),
      new Date('2026-09-28T08:00:00Z'), // Monday, past 09:00 local
    );
    expect(next?.toISOString()).toBe('2026-09-30T07:00:00.000Z'); // Wednesday
  });

  it('never fires a weekly rule with no days', () => {
    expect(nextScheduleOccurrence(rule({ frequency: 'weekly', days: [] }), new Date())).toBeNull();
  });

  it('fires monthly on the day of the month', () => {
    const next = nextScheduleOccurrence(
      rule({ frequency: 'monthly', dayOfMonth: 1 }),
      new Date('2026-09-26T12:00:00Z'),
    );
    expect(next?.toISOString()).toBe('2026-10-01T07:00:00.000Z');
  });

  it('fires hourly at the minute past', () => {
    const next = nextScheduleOccurrence(
      rule({ frequency: 'hourly', minute: 15 }),
      new Date('2026-09-26T12:20:00Z'),
    );
    expect(next?.toISOString()).toBe('2026-09-26T13:15:00.000Z');
  });

  it('fires once in the future and never after', () => {
    const once = rule({ frequency: 'once', date: '2026-09-28', hour: 10, minute: 0 });
    expect(nextScheduleOccurrence(once, new Date('2026-09-26T00:00:00Z'))?.toISOString()).toBe(
      '2026-09-28T08:00:00.000Z',
    );
    expect(nextScheduleOccurrence(once, new Date('2026-09-29T00:00:00Z'))).toBeNull();
  });

  it('works in a zone west of UTC', () => {
    const next = nextScheduleOccurrence(
      rule({ timezone: 'America/Los_Angeles', hour: 9 }),
      new Date('2026-09-26T00:00:00Z'),
    );
    expect(next?.toISOString()).toBe('2026-09-26T16:00:00.000Z');
  });
});

describe('daylight-saving transitions', () => {
  it('moves a skipped wall time forward by the gap (spring forward)', () => {
    // 2026-03-29, Madrid jumps from 02:00 to 03:00: 02:30 does not exist.
    const instant = zonedWallTimeToInstant(
      { year: 2026, month: 3, day: 29, hour: 2, minute: 30 },
      madrid,
    );
    expect(new Date(instant).toISOString()).toBe('2026-03-29T01:30:00.000Z'); // 03:30 CEST
  });

  it('takes the first of a repeated wall time (fall back)', () => {
    // 2026-10-25, Madrid goes from 03:00 back to 02:00: 02:30 happens twice.
    const instant = zonedWallTimeToInstant(
      { year: 2026, month: 10, day: 25, hour: 2, minute: 30 },
      madrid,
    );
    expect(new Date(instant).toISOString()).toBe('2026-10-25T00:30:00.000Z'); // 02:30 CEST
  });

  it('fires a daily rule once on the fall-back night', () => {
    const daily = rule({ hour: 2, minute: 30 });
    const first = nextScheduleOccurrence(daily, new Date('2026-10-24T12:00:00Z'));
    expect(first?.toISOString()).toBe('2026-10-25T00:30:00.000Z');
    const second = nextScheduleOccurrence(daily, first as Date);
    expect(second?.toISOString()).toBe('2026-10-26T01:30:00.000Z');
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA zones and refuses anything else', () => {
    expect(isValidTimeZone('Europe/Madrid')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});
