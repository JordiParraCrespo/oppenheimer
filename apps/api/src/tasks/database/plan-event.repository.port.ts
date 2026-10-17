/** A week's count of one kind of change, for one project. */
export interface PlanEventWeeklyCount {
  /** The Monday the week starts on, in the reader's zone, `YYYY-MM-DD`. */
  weekStart: string;
  projectId: string;
  kind: 'created' | 'completed';
  count: number;
}

export interface PlanEventRangeInput {
  organizationId: string;
  projectId?: string;
  /** Calendar days, `to` included, read in `timeZone`. */
  from: string;
  to: string;
  timeZone: string;
}

/**
 * Reads of Plan's event log. Writes happen beside the change that logs them,
 * in the task and milestone repositories.
 */
export interface PlanEventRepositoryPort {
  /** Tasks created and completed per week and project, between `from` and `to` in `timeZone`. */
  weeklyTaskCounts(input: PlanEventRangeInput): Promise<PlanEventWeeklyCount[]>;
}
