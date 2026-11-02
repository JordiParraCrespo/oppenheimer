import type { SessionUsageWeek } from './database/session-usage.repository.port';

/** The weekly usage aggregate's rows, as `SessionUsageRepository` reads them. */
export class SessionUsageMapper {
  /**
   * One row of the weekly usage aggregate. Postgres sums `bigint` and `numeric`
   * into `numeric`, which `pg` returns as a string, so every figure is read
   * here once rather than at each caller.
   */
  static toWeek(row: unknown): SessionUsageWeek {
    const record = typeof row === 'object' && row !== null ? (row as Record<string, unknown>) : {};
    return {
      weekStart: String(record.weekStart),
      projectId: String(record.projectId),
      model: typeof record.model === 'string' ? record.model : null,
      inputTokens: summed(record.inputTokens),
      outputTokens: summed(record.outputTokens),
      cacheReadTokens: summed(record.cacheReadTokens),
      cacheWriteTokens: summed(record.cacheWriteTokens),
      costUsd: summed(record.costUsd),
      turns: summed(record.turns),
    };
  }
}

/** A sum as the aggregate returns it: a numeric string, a number, or null for nothing summed. */
function summed(value: unknown): number {
  const total = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(total) ? total : 0;
}
