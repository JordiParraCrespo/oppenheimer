import { describe, expect, it } from 'vitest';
import { projectPageSearchSchema } from '../lib/project-page-search';
import { lastWeeks, statsRangeOf, statsRangeSearch } from '../lib/stats-range';

/**
 * A project's Stats period lives in the URL: a plain link is the last eight
 * weeks, a range the API would refuse falls back to it rather than ending
 * on an error, and picking the default again clears the address.
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

  it('falls back to the default rather than ask for a period longer than the API reports on', () => {
    expect(statsRangeOf({ from: '2024-01-01', to: today }, today)).toEqual(lastWeeks(8, today));
    expect(statsRangeOf({ from: '2025-11-03', to: today }, today)).toEqual({
      from: '2025-11-03',
      to: today,
    });
  });

  it('falls back to the default for a day that does not exist, and drops a malformed one', () => {
    expect(statsRangeOf({ from: '2026-02-31', to: today }, today)).toEqual(lastWeeks(8, today));
    expect(projectPageSearchSchema.parse({ view: 'stats', from: 'soon', to: today })).toEqual({
      view: 'stats',
      from: undefined,
      to: today,
    });
  });

  it('writes nothing to the address for the default range', () => {
    expect(statsRangeSearch(lastWeeks(8, today), today)).toEqual({
      from: undefined,
      to: undefined,
    });
    expect(statsRangeSearch(lastWeeks(4, today), today)).toEqual(lastWeeks(4, today));
  });
});
