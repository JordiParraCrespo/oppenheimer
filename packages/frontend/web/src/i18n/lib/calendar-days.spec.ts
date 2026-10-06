import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, monthGridDays, shiftMonth, weekdayOf } from './calendar-days';
import { formatCalendarDay, nearDay } from './format-day';

/**
 * Due dates and event days are calendar days, not instants: arithmetic on them
 * must not move with the reader's timezone or a daylight-saving change.
 */
describe('calendar days', () => {
  it('adds days across a month, a year and the October clock change', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-10-25', -1)).toBe('2026-10-24');
    expect(daysBetween('2026-10-05', '2026-10-04')).toBe(-1);
  });

  it('counts weekdays from Monday, and draws whole weeks for a month', () => {
    expect(weekdayOf('2026-10-05')).toBe(0);
    expect(weekdayOf('2026-10-04')).toBe(6);
    const days = monthGridDays('2026-10');
    expect(days[0]).toBe('2026-09-28');
    expect(days.at(-1)).toBe('2026-11-01');
    expect(days.length % 7).toBe(0);
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('names the near days and formats the rest in the reader’s language', () => {
    expect(nearDay('2026-10-06', '2026-10-05')).toBe('tomorrow');
    expect(nearDay('2026-10-09', '2026-10-05')).toBeNull();
    expect(formatCalendarDay('2026-10-07', 'en', 'short')).toBe('Oct 7');
  });
});
