import { describe, expect, it } from 'vitest';
import { daysBetween, nearDay } from '../calendar-day';

/**
 * Due dates are calendar days, not instants: the distance between two and
 * the words for one next to today must not move with the reader's timezone
 * or a daylight-saving change. What breaks if they drift: a task due
 * tomorrow drawn as overdue, or "Tomorrow" on the wrong day.
 */
describe('calendar days', () => {
  it('counts whole days either way, across the October clock change', () => {
    expect(daysBetween('2026-10-05', '2026-10-04')).toBe(-1);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('names a day next to today, and only those', () => {
    expect(nearDay('2026-10-06', '2026-10-05')).toBe('tomorrow');
    expect(nearDay('2026-10-04', '2026-10-05')).toBe('yesterday');
    expect(nearDay('2026-10-05', '2026-10-05')).toBe('today');
    expect(nearDay('2026-10-09', '2026-10-05')).toBeNull();
  });
});
