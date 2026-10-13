import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { WorkSessionMapper } from '../work-session.mapper';
import { SessionTurnOrmEntity } from './session-turn.orm-entity';
import type {
  SessionUsageReader,
  SessionUsageWeek,
  WeeklySessionUsageInput,
} from './session-usage.repository.port';

/**
 * The weekly usage aggregate over `session_turn`, in one statement.
 *
 * The range is cut in the caller's zone on the database's side: `$from::date`
 * read as a local midnight in `$tz` (`timestamp AT TIME ZONE tz` is that
 * instant), up to the midnight after `$to`. So a day is whatever that zone
 * says it is, 23 or 25 hours across a DST change included, and the week a turn
 * lands in is `date_trunc('week', …)` of its end in that same zone, which
 * starts on Monday. `IDX_session_turn_organization_ended` serves the tenant
 * and the range; the join to `work_session` is on its composite key.
 */
@Injectable()
export class SessionUsageRepository implements SessionUsageReader {
  constructor(
    @InjectRepository(SessionTurnOrmEntity)
    private readonly turns: Repository<SessionTurnOrmEntity>,
    private readonly mapper: WorkSessionMapper,
  ) {}

  async weeklyUsage(input: WeeklySessionUsageInput): Promise<SessionUsageWeek[]> {
    if (input.from > input.to) return [];
    const rows: unknown[] = await this.turns.query(
      `SELECT to_char(date_trunc('week', t."endedAt" AT TIME ZONE $2), 'YYYY-MM-DD') AS "weekStart",
              s."projectId" AS "projectId",
              t."model" AS "model",
              sum(t."inputTokens") AS "inputTokens",
              sum(t."outputTokens") AS "outputTokens",
              sum(t."cacheReadTokens") AS "cacheReadTokens",
              sum(t."cacheWriteTokens") AS "cacheWriteTokens",
              sum(t."costUsd") AS "costUsd",
              count(*)::integer AS "turns"
         FROM "session_turn" t
         JOIN "work_session" s
           ON s."organizationId" = t."organizationId" AND s."id" = t."sessionId"
        WHERE t."organizationId" = $1
          AND t."endedAt" IS NOT NULL
          AND t."endedAt" >= ($3::date)::timestamp AT TIME ZONE $2
          AND t."endedAt" < ($4::date + 1)::timestamp AT TIME ZONE $2
          AND ($5::uuid IS NULL OR s."projectId" = $5::uuid)
        GROUP BY 1, 2, 3
        ORDER BY 1, 2, 3 NULLS FIRST`,
      [input.organizationId, input.timeZone, input.from, input.to, input.projectId ?? null],
    );
    return rows.map((row) => this.mapper.usageWeekToRead(row));
  }
}
