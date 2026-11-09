import type { PlanStatsModelTokens } from '@oppenheimer/frontend-consumer';

/** A token chart's series: one of the busiest models, or every other model summed. */
export interface ModelSeriesRow {
  /** The model's name, `null` for one not reported, `'other'` for the rest. */
  model: string | null | 'other';
  byWeek: number[];
}

/**
 * The models a token chart draws: the `keep` busiest (the API sends them by
 * total, most first), and every one after them summed week by week into one
 * Other series, so a week only a quieter model worked still shows its tokens.
 */
export function modelSeriesOf(
  rows: readonly PlanStatsModelTokens[],
  keep: number,
): ModelSeriesRow[] {
  const top: ModelSeriesRow[] = rows.slice(0, keep).map(({ model, byWeek }) => ({ model, byWeek }));
  const rest = rows.slice(keep);
  if (rest.length === 0) return top;
  const weeks = Math.max(...rows.map((row) => row.byWeek.length));
  const byWeek = Array.from({ length: weeks }, (_, i) =>
    rest.reduce((sum, row) => sum + (row.byWeek[i] ?? 0), 0),
  );
  return [...top, { model: 'other', byWeek }];
}
