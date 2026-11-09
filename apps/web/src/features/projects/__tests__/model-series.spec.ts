import { describe, expect, it } from 'vitest';
import { modelSeriesOf } from '../lib/model-series';

/**
 * The token chart draws the busiest models and sums the rest into Other,
 * so a week only a fourth model worked still shows its tokens instead of
 * reading as no usage under a headline total that counts them.
 */
describe('modelSeriesOf', () => {
  const row = (model: string | null, byWeek: number[]) => ({
    model,
    byWeek,
    total: byWeek.reduce((a, b) => a + b, 0),
  });

  it('keeps every model when there are no more than it draws', () => {
    const rows = [row('sonnet', [5, 1]), row(null, [0, 2])];
    expect(modelSeriesOf(rows, 3)).toEqual([
      { model: 'sonnet', byWeek: [5, 1] },
      { model: null, byWeek: [0, 2] },
    ]);
  });

  it('sums the models past the busiest into one Other series, week by week', () => {
    const rows = [
      row('a', [9, 9]),
      row('b', [5, 5]),
      row('c', [3, 3]),
      row('d', [0, 4]),
      row('e', [1, 0]),
    ];
    expect(modelSeriesOf(rows, 3).at(-1)).toEqual({ model: 'other', byWeek: [1, 4] });
    expect(modelSeriesOf(rows, 3)).toHaveLength(4);
  });
});
