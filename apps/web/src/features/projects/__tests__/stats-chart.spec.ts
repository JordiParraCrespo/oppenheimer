import { describe, expect, it } from 'vitest';
import { changeOf, niceTicks, weeklyPoints } from '../lib/stats-chart';

/**
 * A Stats chart's axis always tops out at or above the busiest week, a week
 * a series has no value for is drawn at 0 rather than dropped, and a change
 * against a period that had nothing is not a percentage.
 */
describe('stats charts', () => {
  it('rules five round values that reach the busiest week', () => {
    expect(niceTicks(0)).toEqual([0, 1, 2, 3, 4]);
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(46)).toEqual([0, 20, 40, 60, 80]);
    expect(niceTicks(13_200_000).at(-1)).toBeGreaterThanOrEqual(13_200_000);
  });

  it('says which way a change went, and nothing against an empty period', () => {
    expect(changeOf(46, 30, true)).toEqual({ value: '+53%', tone: 'good' });
    expect(changeOf(20, 40, true)).toEqual({ value: '−50%', tone: 'bad' });
    expect(changeOf(120, 100, false)).toEqual({ value: '+20%', tone: 'bad' });
    expect(changeOf(12, 10, null)).toEqual({ value: '+20%', tone: 'flat' });
    expect(changeOf(5, 0, true)).toBeNull();
    expect(changeOf(null, 3, true)).toBeNull();
  });

  it('puts every series on every week, 0 where a series ends early', () => {
    expect(weeklyPoints(['Oct 5', 'Oct 12'], { done: [3], made: [1, 2] })).toEqual([
      { label: 'Oct 5', values: { done: 3, made: 1 } },
      { label: 'Oct 12', values: { done: 0, made: 2 } },
    ]);
  });
});
