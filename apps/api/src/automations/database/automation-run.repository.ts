import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import { LISTED_RUN_STATUSES } from '@oppenheimer/shared/automations';
import { None, type Option, Some } from 'oxide.ts';
import { DataSource, type EntityManager, Repository } from 'typeorm';
import { AutomationRunMapper } from '../automation-run.mapper';
import { AutomationResource } from '../automations.resource';
import type {
  AutomationRunDigest,
  RunHistoryBucket,
  RunPage,
  RunReadModel,
} from '../domain/automation-read.types';
import type { AutomationRunEntity } from '../domain/automation-run.entity';
import { AutomationRunOrmEntity } from './automation-run.orm-entity';
import type { AutomationRunRepositoryPort, RunFilters } from './automation-run.repository.port';

/** The job name the runs worker dispatches a pending run under. */
export const DISPATCH_RUN_JOB = 'dispatch';

const LIVE_TURN = `('queued', 'in_progress', 'requires_action')`;

/**
 * A run's status, derived once, here (§Q4): the firing's own outcome until it
 * is dispatched, then the session's first turn — and, for a session whose turn
 * has not been folded yet, the session's lifecycle.
 */
const STATUS_SQL = `
  CASE
    WHEN run."outcome" = 'pending' THEN 'queued'
    WHEN run."outcome" = 'skipped' THEN 'skipped'
    WHEN run."outcome" = 'expired' THEN 'expired'
    WHEN turn."state" IS NULL THEN
      CASE ws."state" WHEN 'failed' THEN 'failed' WHEN 'resolved' THEN 'completed' ELSE 'running' END
    WHEN turn."state" = 'queued' THEN 'queued'
    WHEN turn."state" IN ('in_progress', 'requires_action') THEN 'running'
    ELSE turn."state"
  END`;

/**
 * The read model's one select. It names three tables of the sessions module —
 * `work_session`, `session_turn`, `session_checkout` — which the composite
 * foreign key from `automation_run` already does: execution lives there, and a
 * run list that could not filter by it would have to page in memory. It only
 * ever reads them.
 */
const READ_MODEL_SQL = `
  SELECT
    run."id", run."automationId", run."cause", run."causeSummary", run."outcome",
    run."skipReason", run."sessionId", run."createdAt", run."scheduledFor", run."dispatchedAt",
    a."name" AS "automationName", a."deletedAt" AS "automationDeletedAt", a."projectId",
    rev."number" AS "revisionNumber", rev."agent", rev."model", rev."hostId",
    ws."name" AS "sessionName", ws."nameSource" AS "sessionNameSource",
    (SELECT c."branch" FROM "session_checkout" c
      WHERE c."sessionId" = run."sessionId" ORDER BY c."createdAt" LIMIT 1) AS "branch",
    turn."state" AS "turnState", turn."startedAt" AS "turnStartedAt", turn."endedAt" AS "turnEndedAt",
    turn."exitCode" AS "turnExitCode", turn."result" AS "turnResult",
    turn."failureDetail" AS "turnFailureDetail", turn."costUsd" AS "turnCostUsd",
    turn."permissionDenials" AS "turnPermissionDenials", turn."prompt" AS "turnPrompt",
    ${STATUS_SQL} AS "status"
  FROM "automation_run" run
  JOIN "automation" a ON a."id" = run."automationId"
  JOIN "automation_revision" rev ON rev."id" = run."revisionId"
  LEFT JOIN "work_session" ws ON ws."id" = run."sessionId"
  LEFT JOIN "session_turn" turn ON turn."sessionId" = run."sessionId" AND turn."seq" = 1`;

/** Insert a firing and, when it is pending, stage its dispatch — inside the caller's transaction. */
export async function insertRunWithin(
  manager: EntityManager,
  outbox: OutboxService,
  mapper: AutomationRunMapper,
  run: AutomationRunEntity,
): Promise<boolean> {
  const record = mapper.toRecord(run);
  const inserted: { id: string }[] = await manager.query(
    `INSERT INTO "automation_run"
       ("id", "organizationId", "automationId", "revisionId", "triggerId", "cause", "causeKey",
        "causeSummary", "inboundEventId", "scheduledFor", "outcome", "skipReason",
        "availableAt", "attempts", "requestedByUserId")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT ("automationId", "causeKey") DO NOTHING
     RETURNING "id"`,
    [
      record.id,
      record.organizationId,
      record.automationId,
      record.revisionId,
      record.triggerId,
      record.cause,
      record.causeKey,
      record.causeSummary,
      record.inboundEventId,
      record.scheduledFor,
      record.outcome,
      record.skipReason,
      record.availableAt,
      record.attempts,
      record.requestedByUserId,
    ],
  );
  if (inserted.length === 0) return false;
  if (run.isPending) await stageDispatch(manager, outbox, run);
  return true;
}

async function stageDispatch(
  manager: EntityManager,
  outbox: OutboxService,
  run: AutomationRunEntity,
): Promise<void> {
  await outbox.stageJob(manager, {
    queue: QUEUE_NAMES.AUTOMATION_RUNS,
    jobName: DISPATCH_RUN_JOB,
    payload: { runId: run.id },
    reason: `automation ${run.automationId} fired (${run.cause}) and its run owes a dispatch`,
    aggregateId: run.id,
    availableAt: run.availableAt,
  });
}

@Injectable()
export class AutomationRunRepository
  extends ScopedRepositoryBase<AutomationRunOrmEntity>
  implements AutomationRunRepositoryPort
{
  protected readonly resource = AutomationResource;
  protected readonly alias = 'run';

  constructor(
    @InjectRepository(AutomationRunOrmEntity)
    protected readonly repository: Repository<AutomationRunOrmEntity>,
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
    private readonly mapper: AutomationRunMapper,
  ) {
    super();
  }

  async insertFiring(run: AutomationRunEntity): Promise<boolean> {
    const inserted = await this.dataSource.transaction((manager) =>
      insertRunWithin(manager, this.outbox, this.mapper, run),
    );
    if (inserted && run.isPending) await this.outbox.wake();
    return inserted;
  }

  async findOneForSystem(id: string): Promise<Option<AutomationRunEntity>> {
    const record = await this.repository.findOneBy({ id });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async save(run: AutomationRunEntity): Promise<void> {
    const record = this.mapper.toRecord(run);
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE "automation_run"
            SET "outcome" = $2, "skipReason" = $3, "availableAt" = $4, "attempts" = $5,
                "sessionId" = $6, "dispatchedAt" = $7, "revisionId" = $8, "updatedAt" = now()
          WHERE "id" = $1`,
        [
          record.id,
          record.outcome,
          record.skipReason,
          record.availableAt,
          record.attempts,
          record.sessionId,
          record.dispatchedAt,
          record.revisionId,
        ],
      );
      // A deferral owes another look later; the delay rides the outbox row.
      if (run.isPending) await stageDispatch(manager, this.outbox, run);
    });
    if (run.isPending) await this.outbox.wake();
  }

  async countRecent(
    organizationId: string,
    automationId: string,
    since: Date,
  ): Promise<{ automation: number; workspace: number }> {
    const [row]: { automation: string; workspace: string }[] = await this.dataSource.query(
      `SELECT count(*) FILTER (WHERE "automationId" = $2) AS "automation", count(*) AS "workspace"
         FROM "automation_run"
        WHERE "organizationId" = $1 AND "createdAt" >= $3
          AND "outcome" IN ('pending', 'dispatched')`,
      [organizationId, automationId, since],
    );
    return { automation: Number(row.automation), workspace: Number(row.workspace) };
  }

  async countLiveForAutomation(automationId: string, excludingRunId: string): Promise<number> {
    return this.countLive(`run."automationId" = $1`, [automationId, excludingRunId]);
  }

  async countLiveOnHost(hostId: string, excludingRunId: string): Promise<number> {
    return this.countLive(`rev."hostId" = $1`, [hostId, excludingRunId]);
  }

  private async countLive(where: string, parameters: unknown[]): Promise<number> {
    const [row]: { count: string }[] = await this.dataSource.query(
      `SELECT count(*) AS "count"
         FROM "automation_run" run
         JOIN "automation_revision" rev ON rev."id" = run."revisionId"
         LEFT JOIN "work_session" ws ON ws."id" = run."sessionId"
         LEFT JOIN "session_turn" turn ON turn."sessionId" = run."sessionId" AND turn."seq" = 1
        WHERE ${where} AND run."id" <> $2 AND run."outcome" = 'dispatched'
          AND (turn."state" IN ${LIVE_TURN}
               OR (turn."state" IS NULL AND ws."state" IN ('starting', 'open')))`,
      parameters,
    );
    return Number(row.count);
  }

  /** The runs the caller can reach under the facets, as a CTE both the page and the counts read. */
  private scopedRuns(scope: AccessScope, filters: Omit<RunFilters, 'statuses'>) {
    const [reachable, parameters] = this.scopedQuery(scope)
      .select(`${this.alias}.id`)
      .getQueryAndParameters();
    const values: unknown[] = [...parameters, filters.since];
    const where = [`run."id" IN (${reachable})`, `run."createdAt" >= $${values.length}`];
    if (filters.automationId) {
      values.push(filters.automationId);
      where.push(`run."automationId" = $${values.length}`);
    }
    if (filters.projectId) {
      values.push(filters.projectId);
      where.push(`a."projectId" = $${values.length}`);
    }
    return { cte: `WITH runs AS (${READ_MODEL_SQL} WHERE ${where.join(' AND ')})`, values };
  }

  async page(
    scope: AccessScope,
    filters: RunFilters,
    page: number,
    limit: number,
  ): Promise<RunPage> {
    const { cte, values } = this.scopedRuns(scope, filters);
    const statuses = [...(filters.statuses ?? LISTED_RUN_STATUSES)];
    const statusParameter = `$${values.length + 1}`;
    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `${cte} SELECT * FROM runs WHERE "status" = ANY(${statusParameter})
        ORDER BY "createdAt" DESC, "id" DESC
        LIMIT $${values.length + 2} OFFSET $${values.length + 3}`,
      [...values, statuses, limit, (page - 1) * limit],
    );
    const [{ total }]: { total: string }[] = await this.dataSource.query(
      `${cte} SELECT count(*) AS "total" FROM runs WHERE "status" = ANY(${statusParameter})`,
      [...values, statuses],
    );
    const grouped: { status: string; count: string }[] = await this.dataSource.query(
      `${cte} SELECT "status", count(*) AS "count" FROM runs
        WHERE "status" = ANY(${statusParameter}) GROUP BY "status"`,
      [...values, [...LISTED_RUN_STATUSES]],
    );
    const counted = new Map(grouped.map((row) => [row.status, Number(row.count)]));
    return {
      items: rows.map((row) => this.mapper.readModelOf(row)),
      total: Number(total),
      counts: {
        all: [...counted.values()].reduce((sum, count) => sum + count, 0),
        completed: counted.get('completed') ?? 0,
        failed: counted.get('failed') ?? 0,
        running: (counted.get('running') ?? 0) + (counted.get('queued') ?? 0),
      },
    };
  }

  async history(
    scope: AccessScope,
    filters: Omit<RunFilters, 'statuses'>,
    timezone: string,
  ): Promise<RunHistoryBucket[]> {
    const { cte, values } = this.scopedRuns(scope, filters);
    const rows: { date: string; succeeded: string; failed: string }[] = await this.dataSource.query(
      `${cte}
       SELECT to_char(("createdAt" AT TIME ZONE $${values.length + 1})::date, 'YYYY-MM-DD') AS "date",
              count(*) FILTER (WHERE "status" <> 'failed') AS "succeeded",
              count(*) FILTER (WHERE "status" = 'failed') AS "failed"
         FROM runs WHERE "status" = ANY($${values.length + 2})
        GROUP BY 1 ORDER BY 1`,
      [...values, timezone, [...LISTED_RUN_STATUSES]],
    );
    return rows.map((row) => ({
      date: row.date,
      succeeded: Number(row.succeeded),
      failed: Number(row.failed),
    }));
  }

  async findOne(scope: AccessScope, id: string): Promise<Option<RunReadModel>> {
    const [reachable, parameters] = this.scopedQuery(scope)
      .select(`${this.alias}.id`)
      .andWhere(`${this.alias}.id = :runId`, { runId: id })
      .getQueryAndParameters();
    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `${READ_MODEL_SQL} WHERE run."id" IN (${reachable})`,
      parameters,
    );
    return rows.length > 0 ? Some(this.mapper.readModelOf(rows[0])) : None;
  }

  async digests(
    scope: AccessScope,
    automationIds: readonly string[],
    since: Date,
  ): Promise<Map<string, AutomationRunDigest>> {
    const digests = new Map<string, AutomationRunDigest>();
    if (automationIds.length === 0) return digests;
    const { cte, values } = this.scopedRuns(scope, { since });
    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `${cte}
       SELECT * FROM (
         SELECT runs.*,
                row_number() OVER (PARTITION BY "automationId" ORDER BY "createdAt" DESC, "id" DESC) AS "rank",
                count(*) OVER (PARTITION BY "automationId") AS "runCount",
                bool_or("status" IN ('queued', 'running')) OVER (PARTITION BY "automationId") AS "running"
           FROM runs
          WHERE "automationId" = ANY($${values.length + 1}) AND "status" = ANY($${values.length + 2})
       ) ranked WHERE "rank" <= 6
       ORDER BY "automationId", "rank"`,
      [...values, [...automationIds], [...LISTED_RUN_STATUSES]],
    );
    for (const row of rows) {
      const automationId = String(row.automationId);
      const digest = digests.get(automationId) ?? {
        running: Boolean(row.running),
        runCount: Number(row.runCount),
        lastRuns: [],
      };
      digest.lastRuns.push(this.mapper.readModelOf(row));
      digests.set(automationId, digest);
    }
    return digests;
  }

  async deleteBefore(cutoff: Date, batch: number): Promise<number> {
    const [, affected]: [unknown, number] = await this.dataSource.query(
      `DELETE FROM "automation_run"
        WHERE ctid = ANY (ARRAY(
          SELECT ctid FROM "automation_run" WHERE "createdAt" < $1 LIMIT $2
        ))`,
      [cutoff, batch],
    );
    return affected ?? 0;
  }
}
