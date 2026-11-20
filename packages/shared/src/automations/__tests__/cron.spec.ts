import { describe, expect, it } from 'vitest';
import { scheduleTriggerInputSchema } from '../../schemas/automation.schema.js';
import { cronProblem, cronToEnglish, describeCron, parseCron } from '../cron.js';
import { nextScheduleOccurrence } from '../schedule.js';

const madrid = 'Europe/Madrid';

function next(expression: string, after: string, timezone = madrid): string | undefined {
  return nextScheduleOccurrence(
    { frequency: 'cron', hour: 0, minute: 0, expression, timezone },
    new Date(after),
  )?.toISOString();
}

describe('a cron schedule fires what the fixed frequencies cannot say', () => {
  it('several times a day', () => {
    // 12:00 CEST → the 13:00 slot.
    expect(next('0 9,13,18 * * *', '2026-07-01T10:00:00Z')).toBe('2026-07-01T11:00:00.000Z');
  });

  it('every 15 minutes in work hours only, skipping the weekend', () => {
    // Friday 17:50 CEST is past the last slot (17:45) → Monday 09:00.
    expect(next('*/15 9-17 * * 1-5', '2026-09-25T15:50:00Z')).toBe('2026-09-28T07:00:00.000Z');
    expect(next('*/15 9-17 * * 1-5', '2026-09-28T07:00:00Z')).toBe('2026-09-28T07:15:00.000Z');
  });

  it('the last weekday of the month, a Friday when the 31st is a Saturday', () => {
    // 30 October 2026 is past the fall-back, so CET (UTC+1).
    expect(next('0 17 LW * *', '2026-10-01T00:00:00Z')).toBe('2026-10-30T16:00:00.000Z');
  });

  it('the second Tuesday, and the last Friday', () => {
    expect(next('0 10 * * 2#2', '2026-09-01T12:00:00Z')).toBe('2026-09-08T08:00:00.000Z');
    expect(next('0 16 * * 5L', '2026-09-01T00:00:00Z')).toBe('2026-09-25T14:00:00.000Z');
  });

  it('either day field when both are restricted, as every cron does', () => {
    // Saturday 26 September: Monday the 28th comes before the 1st.
    expect(next('0 9 1 * 1', '2026-09-26T12:00:00Z')).toBe('2026-09-28T07:00:00.000Z');
  });

  it('both day fields when one is written from a star, as Vixie cron reads it', () => {
    // Odd days that are Mondays: not Sunday the 27th, not Monday the 28th, but 5 October.
    expect(next('0 9 */2 * 1', '2026-09-26T12:00:00Z')).toBe('2026-10-05T07:00:00.000Z');
    expect(cronToEnglish('0 9 */2 * 1')).toContain('when that is a Monday');
  });

  it('a day that comes once in four years, and none for a day that never comes', () => {
    expect(next('0 12 29 2 *', '2026-03-01T00:00:00Z')).toBe('2028-02-29T11:00:00.000Z');
    expect(next('0 0 30 2 *', '2026-03-01T00:00:00Z')).toBeUndefined();
  });
});

describe('a cron schedule keeps the daylight-saving rules', () => {
  it('fires a skipped wall time as though the clock had not jumped', () => {
    // 29 March 2026: 02:00 CET jumps to 03:00 CEST, so 02:30 lands at 03:30 CEST.
    expect(next('30 2 * * *', '2026-03-29T00:00:00Z')).toBe('2026-03-29T01:30:00.000Z');
  });

  it('fires once when the skipped slot lands on another slot', () => {
    expect(next('30 2,3 * * *', '2026-03-29T00:00:00Z')).toBe('2026-03-29T01:30:00.000Z');
    expect(next('30 2,3 * * *', '2026-03-29T01:30:00Z')).toBe('2026-03-30T00:30:00.000Z');
  });

  it('fires a repeated wall time once, at its first occurrence', () => {
    // 25 October 2026: 03:00 CEST falls back to 02:00 CET; 02:30 happens twice.
    expect(next('30 2 * * *', '2026-10-25T00:00:00Z')).toBe('2026-10-25T00:30:00.000Z');
    expect(next('30 2 * * *', '2026-10-25T00:30:00Z')).toBe('2026-10-26T01:30:00.000Z');
  });
});

describe('what a schedule may store', () => {
  it('reads names, 7 as Sunday and steps, and refuses what is not five fields in range', () => {
    expect(parseCron('0 9 * JAN,jul SUN')?.months).toEqual([1, 7]);
    expect(parseCron('0 9 * * 7')?.dayOfWeek).toEqual({ kind: 'days', days: [0], starred: false });
    expect(parseCron('0 9 * * 5-7')?.dayOfWeek).toEqual({
      kind: 'days',
      days: [0, 5, 6],
      starred: false,
    });
    for (const bad of [
      '',
      '0 9 * *',
      '60 9 * * *',
      '0 24 * * *',
      '0 9 0 * *',
      '0 9 * 13 *',
      '0 9 * * 2#6',
      '5-1 * * * *',
      '*/0 * * * *',
    ]) {
      expect(parseCron(bad), bad).toBeNull();
    }
  });

  it('refuses two firings closer than five minutes, however few an hour', () => {
    expect(cronProblem('*/5 * * * *')).toBeNull();
    expect(cronProblem('0,55 * * * *')).toBeNull();
    expect(cronProblem('*/4 * * * *')).toBe('too_often');
    expect(cronProblem('0-11 * * * *')).toBe('too_often');
    // :58 and the next hour's :00 are two minutes apart.
    expect(cronProblem('0,58 * * * *')).toBe('too_often');
  });

  it('takes an expression with cron only, and a valid one', () => {
    const base = { source: 'schedule', hour: 0, minute: 0, timezone: madrid } as const;
    expect(
      scheduleTriggerInputSchema.safeParse({ ...base, frequency: 'cron', expression: '0 9 * * 1' })
        .success,
    ).toBe(true);
    expect(scheduleTriggerInputSchema.safeParse({ ...base, frequency: 'cron' }).success).toBe(
      false,
    );
    expect(
      scheduleTriggerInputSchema.safeParse({ ...base, frequency: 'daily', expression: '0 9 * * 1' })
        .success,
    ).toBe(false);
    expect(
      scheduleTriggerInputSchema.safeParse({ ...base, frequency: 'cron', expression: '* * * * *' })
        .success,
    ).toBe(false);
  });
});

describe('a cron schedule in words', () => {
  it('says the issue’s four examples without the fields', () => {
    expect(cronToEnglish('0 9,13,18 * * *')).toBe('At 09:00, 13:00 and 18:00, every day');
    expect(cronToEnglish('*/15 9-17 * * 1-5')).toBe(
      'Every 15 minutes from 09:00 to 17:45, Monday to Friday',
    );
    expect(cronToEnglish('0 17 LW * *')).toBe('At 17:00, on the last weekday of the month');
    expect(cronToEnglish('0 10 * * 2#2')).toBe('At 10:00, on the second Tuesday of the month');
  });

  it('says hour steps, months and both day fields', () => {
    expect(cronToEnglish('0 */2 * * 1-5')).toBe('Every 2 hours at :00, Monday to Friday');
    expect(cronToEnglish('30 9 1 1,7 *')).toBe(
      'At 09:30, on day 1 of the month, in January and July',
    );
    expect(describeCron('0 9 1 * 1')?.day).toEqual({
      kind: 'either',
      monthDays: { kind: 'monthDays', days: [1] },
      weekDays: { kind: 'weekDays', days: [1] },
    });
  });
});
