/** One model's tokens over a period, and per week. `null` is a turn whose model was not reported. */
export interface PlanStatsModelTokens {
  model: string | null;
  total: number;
  byWeek: number[];
}

/** A period's headline totals; `null` where nothing was measured. */
export interface PlanStatsTotals {
  tasksCompleted: number;
  tasksCreated: number;
  tokens: number | null;
  costUsd: number | null;
}

/**
 * Plan's statistics over a range (`product/versions/mvp/23-plan-milestones-stats-accounts.md`
 * §4), for the workspace or one project: weekly series, the headline totals,
 * and the same totals for the period of the same length before it.
 * `tokensMeasured` is `none` until some session reports its usage.
 */
export interface PlanStats {
  /** The Monday that opens each week, `YYYY-MM-DD`, in the order of every series. */
  weeks: string[];
  current: PlanStatsTotals & {
    completedByWeek: number[];
    createdByWeek: number[];
    tokensByModel: PlanStatsModelTokens[] | null;
    costByWeek: number[] | null;
  };
  previous: PlanStatsTotals | null;
  tokensMeasured: 'headless' | 'none';
}

/** What a stats read asks for: days in the reader's calendar and their timezone. */
export interface PlanStatsQuery {
  from: string;
  to: string;
  timeZone: string;
  projectId?: string;
}
