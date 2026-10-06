import { describe, expect, it } from 'vitest';
import { analyticsWindow, daysOf, median, periodOf } from '../domain/pull-request-analytics.policy';

const NOW = new Date('2026-10-06T12:00:00.000Z');

describe('the analytics window', () => {
  it('places a moment in this period, the one before, or neither', () => {
    const window = analyticsWindow('week', NOW);
    expect(periodOf('2026-10-05T00:00:00.000Z', window)).toBe('current');
    expect(periodOf('2026-09-28T00:00:00.000Z', window)).toBe('previous');
    expect(periodOf('2026-09-01T00:00:00.000Z', window)).toBeNull();
    expect(periodOf(null, window)).toBeNull();
  });

  it('lists one day per day of the range, ending today', () => {
    const days = daysOf(analyticsWindow('week', NOW));
    expect(days).toHaveLength(7);
    expect(days.at(-1)).toBe('2026-10-06');
  });
});

describe('the median', () => {
  it('is what one stuck pull request cannot move', () => {
    expect(median([])).toBeNull();
    expect(median([1, 2, 900])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});
