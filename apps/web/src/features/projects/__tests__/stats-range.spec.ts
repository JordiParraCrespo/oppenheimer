import { describe, expect, it } from 'vitest';
import { changeOf, lastWeeks, niceTicks, statsRangeOf, statsRangeSearch } from '../lib/stats-range';

/**
 * A project's Stats period lives in the URL: a plain link is the last eight
 * weeks, a backwards range falls back to it rather than asking the API for
 * nothing, and picking the default again clears the address. The chart's
 * axis always tops out at or above the busiest week, and a change against a
 * period that had nothing is not a percentage.
 */
describe('stats range', () => {
  const today = '2026-11-08';

  it('defaults to eight whole weeks ending today, and a backwards range falls back to it', () => {
    expect(statsRangeOf({}, today)).toEqual({ from: '2026-09-14', to: today });
    expect(statsRangeOf({ from: '2026-11-01', to: '2026-10-01' }, today)).toEqual(
      lastWeeks(8, today),
    );
    expect(statsRangeOf({ from: '2026-10-01', to: '2026-10-31' }, today)).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
  });

  it('writes nothing to the address for the default range', () => {
    expect(statsRangeSearch(lastWeeks(8, today), today)).toEqual({
      from: undefined,
      to: undefined,
    });
    expect(statsRangeSearch(lastWeeks(4, today), today)).toEqual(lastWeeks(4, today));
  });

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
});
