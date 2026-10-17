/** One organization's agent usage for a period, as Plan's Stats asks for it. */
export interface WeeklySessionUsageInput {
  organizationId: string;
  /** Only turns of this project's sessions; absent for every project. */
  projectId?: string;
  /** The first day of the period, `YYYY-MM-DD`, in `timeZone`. */
  from: string;
  /** The last day of the period, inclusive, `YYYY-MM-DD`, in `timeZone`. */
  to: string;
  /** IANA zone the days and weeks are cut in (`Europe/Madrid`). The caller validates it. */
  timeZone: string;
}

/**
 * One week × project × model of ended turns.
 *
 * A turn counts in the week its `endedAt` falls in, read in the caller's zone;
 * its project is its session's `work_session.projectId`. Every ended turn is
 * counted in `turns`, measured or not: an interactive turn reports no usage,
 * so it lands under `model: null` with nothing added to the sums. Tokens and
 * cost are the agent's own figures, summed; nothing is priced here.
 */
export interface SessionUsageWeek {
  /** The Monday that starts the week, `YYYY-MM-DD`, in the input's zone. */
  weekStart: string;
  projectId: string;
  /** The model the agent reported, or `null` for turns that reported none. */
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  turns: number;
}

/**
 * The sessions module's published read of turn usage, for other modules
 * (23 §4: Plan's Stats reads tokens per model and agent cost through it).
 *
 * A read port, not a `RepositoryPort`: it aggregates `session_turn` and never
 * hands out a turn, so nothing that holds it can write one. Bound to
 * `SESSION_USAGE_READER` and exported by `SessionsModule`.
 */
export interface SessionUsageReader {
  /**
   * Usage per week, project and model over `[from 00:00, to + 1 day 00:00)` in
   * `timeZone`, ordered by week, then project, then model (null first). Weeks
   * with no ended turn are absent rather than zero rows.
   */
  weeklyUsage(input: WeeklySessionUsageInput): Promise<SessionUsageWeek[]>;
}
