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
import type {
  AutomationRunRepositoryPort,
  LiveRun,
  RunFilters,
} from './automation-run.repository.port';

/** The job name the runs worker dispatches a pending run under. */
export const DISPATCH_RUN_JOB = 'dispatch';

const LIVE_TURN = `('queued', 'in_progress', 'requires_action')`;

/**
 * A dispatched run is live while its session's first turn has not ended —
 * the agent is still on the task it was given — or, before that turn is
 * folded, while the session has not started or failed. A session left open
 * after its agent finished is not a live run: it holds no place on the host.
 */
const LIVE_JOINS = `
  LEFT JOIN "work_session" ws ON ws."id" = run."sessionId"
  LEFT JOIN "session_turn" turn ON turn."sessionId" = run."sessionId" AND turn."seq" = 1`;
/**
 * A run is live while its session is.
 *
 * `ws."stoppedAt"` is the half that is easy to miss: stopping a session ends
 * its processes and leaves the worktree, so the lifecycle deliberately does
 * *not* move — a stopped session is still `open`, with `stoppedAt` set, and
 * can be restarted (`session-state.policy`). Counted as live, every stopped
 * session held one of its host's slots for ever: measured, six of them on one
 * host filled a `liveRunsPerHost` of two, and every automation pointed at that
 * host stopped dispatching, deferring for ever behind panes that had not
 * existed for hours.
 */
const LIVE_WHERE = `(ws."stoppedAt" IS NULL AND (turn."state" IN ${LIVE_TURN}
  OR (turn."state" IS NULL AND ws."state" IN ('starting', 'open'))))`;

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
  await outbox.stageEvents(manager, run.domainEvents);
  run.clearEvents();
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

/** What the hourly caps count: firings in the window that were not skipped or expired. */
const COUNTED_OUTCOMES = `('pending', 'dispatched')`;

/**
 * Take the firing lock of each workspace, for the rest of the caller's
 * transaction: every path that weighs a firing against the hourly caps — the
 * scheduler's tick, an event — counts and inserts under it, so two of them
 * cannot both read the same count and both take the last slot. One
 * transaction-scoped advisory lock per workspace, taken in one fixed order so
 * a tick holding several never deadlocks with another; the key is namespaced
 * so it cannot meet another module's advisory lock by accident.
 */
export async function lockWorkspaceFiring(
  manager: EntityManager,
  organizationIds: readonly string[],
): Promise<void> {
  if (organizationIds.length === 0) return;
  await manager.query(
    `SELECT pg_advisory_xact_lock(hashtext('automation-firing:' || ordered."id"))
       FROM (SELECT DISTINCT "id" FROM unnest($1::text[]) AS "id" ORDER BY "id") ordered`,
    [[...organizationIds]],
  );
}

/**
 * Take a host's dispatch lock for the rest of the caller's transaction.
 *
 * The firing lock above keeps two firings from taking the same hourly slot.
 * This is its counterpart one step later: the overlap and capacity guards
 * count what is live on a host, and without a lock every dispatch the queue
 * runs at once reads the same count and every one of them passes. Measured, a
 * cap of one live run per automation let four through — the processor's
 * concurrency, exactly.
 *
 * The host is the scope because `liveRunsPerHost` is the host-wide guard and a
 * run carries its revision's host, so two runs that could contend always share
 * one. Dispatch to other hosts is untouched. Same namespaced, transaction
 * scoped advisory lock, for the same reasons written above it.
 */
export async function lockHostDispatch(manager: EntityManager, hostId: string): Promise<void> {
  await manager.query(
    `SELECT pg_advisory_xact_lock(hashtext('automation-dispatch:' || $1::text))`,
    [hostId],
  );
}

/** The last hour's counted firings, for the rate guards — inside the caller's transaction. */
export async function countRecentWithin(
  manager: EntityManager,
  organizationId: string,
  automationId: string,
  since: Date,
): Promise<{ automation: number; workspace: number }> {
  const [row]: { automation: string; workspace: string }[] = await manager.query(
    `SELECT count(*) FILTER (WHERE "automationId" = $2) AS "automation", count(*) AS "workspace"
       FROM "automation_run"
      WHERE "organizationId" = $1 AND "createdAt" >= $3 AND "outcome" IN ${COUNTED_OUTCOMES}`,
    [organizationId, automationId, since],
  );
  return { automation: Number(row.automation), workspace: Number(row.workspace) };
}

/**
 * The last hour's counted firings of several workspaces in one statement, per
 * automation and per workspace (IDX_automation_run_organization_created).
 */
export async function countRecentByWorkspaceWithin(
  manager: EntityManager,
  organizationIds: readonly string[],
  since: Date,
): Promise<{ byAutomation: Map<string, number>; byWorkspace: Map<string, number> }> {
  const byAutomation = new Map<string, number>();
  const byWorkspace = new Map<string, number>();
  if (organizationIds.length === 0) return { byAutomation, byWorkspace };
  const rows: { organizationId: string; automationId: string | null; count: string }[] =
    await manager.query(
      `SELECT "organizationId",
              CASE WHEN GROUPING("automationId") = 0 THEN "automationId" END AS "automationId",
              count(*) AS "count"
         FROM "automation_run"
        WHERE "organizationId" = ANY($1::uuid[]) AND "createdAt" >= $2
          AND "outcome" IN ${COUNTED_OUTCOMES}
        GROUP BY GROUPING SETS (("organizationId", "automationId"), ("organizationId"))`,
      [[...organizationIds], since],
    );
  for (const row of rows) {
    if (row.automationId === null) byWorkspace.set(row.organizationId, Number(row.count));
    else byAutomation.set(row.automationId, Number(row.count));
  }
  return { byAutomation, byWorkspace };
}

/**
 * The runs list's tenant clause, on `run."organizationId"` itself, so the
 * planner bounds it by the window on IDX_automation_run_organization_created
 * instead of semi-joining every run the workspace kept. It restates what
 * `applyAccessScope` (packages/backend/authz/src/scope/apply-access-scope.ts)
 * does for an organization-only resource — a bypass reaches every workspace
 * (audited upstream), a scope with no organization reaches nothing — and is
 * right only while `AutomationResource.scopes` is `['organization']`; a test
 * pins that. `null` is no clause at all.
 */
export function runTenantPredicate(
  scope: AccessScope,
  parameterIndex: number,
): { clause: string; values: unknown[] } | null {
  if (scope.bypass) return null;
  if (!scope.organizationId) return { clause: 'FALSE', values: [] };
  return { clause: `run."organizationId" = $${parameterIndex}`, values: [scope.organizationId] };
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

  async insertFiring(run: AutomationRunEntity): Promise<{ runId: string; inserted: boolean }> {
    const inserted = await this.outbox.transaction((manager) =>
      insertRunWithin(manager, this.outbox, this.mapper, run),
    );
    if (inserted) return { runId: run.id, inserted };
    const existing: { id: string }[] = await this.dataSource.query(
      `SELECT "id" FROM "automation_run" WHERE "automationId" = $1 AND "causeKey" = $2`,
      [run.automationId, run.causeKey],
    );
    return { runId: existing[0]?.id ?? run.id, inserted };
  }

  /**
   * Why an advisory lock, and not `SERIALIZABLE` or a counter row: serializable
   * would turn the race into retry storms on a busy workspace and every firing
   * path would need retry handling; a counter row per workspace-hour is a hot
   * row and a second truth. The lock is held for one count and one insert,
   * transaction-scoped, so it needs no cleanup.
   */
  async fireUnderCaps(
    organizationId: string,
    automationId: string,
    since: Date,
    decide: (recent: { automation: number; workspace: number }) => AutomationRunEntity,
  ): Promise<{ run: AutomationRunEntity; runId: string; inserted: boolean }> {
    const { run, inserted } = await this.outbox.transaction(async (manager) => {
      await lockWorkspaceFiring(manager, [organizationId]);
      const decided = decide(await countRecentWithin(manager, organizationId, automationId, since));
      return {
        run: decided,
        inserted: await insertRunWithin(manager, this.outbox, this.mapper, decided),
      };
    });
    if (inserted) return { run, runId: run.id, inserted };
    return { run, runId: await this.firingOfCause(run), inserted };
  }

  /** The run a duplicate cause already made, so a retried request reads the same run. */
  private async firingOfCause(run: AutomationRunEntity): Promise<string> {
    const existing: { id: string }[] = await this.dataSource.query(
      `SELECT "id" FROM "automation_run" WHERE "automationId" = $1 AND "causeKey" = $2`,
      [run.automationId, run.causeKey],
    );
    return existing[0]?.id ?? run.id;
  }

  async restageStalled(staleBefore: Date, batch: number): Promise<number> {
    return this.outbox.transaction(async (manager) => {
      // IDX_automation_run_pending; SKIP LOCKED so replicas sweep disjoint rows.
      // Destructured: TypeORM answers an UPDATE with `[rows, affected]`, not the
      // rows (`PostgresQueryRunner.query`); the restage-stalled spec guards it.
      const [due]: [{ id: string; automationId: string; cause: string }[], number] =
        await manager.query(
          `UPDATE "automation_run" r SET "availableAt" = now(), "updatedAt" = now()
           FROM (SELECT "id" FROM "automation_run"
                  WHERE "outcome" = 'pending' AND "availableAt" < $1
                  ORDER BY "availableAt" LIMIT $2 FOR UPDATE SKIP LOCKED) due
          WHERE r."id" = due."id"
          RETURNING r."id", r."automationId", r."cause"`,
          [staleBefore, batch],
        );
      for (const row of due) {
        await this.outbox.stageJob(manager, {
          queue: QUEUE_NAMES.AUTOMATION_RUNS,
          jobName: DISPATCH_RUN_JOB,
          payload: { runId: row.id },
          reason: `automation ${row.automationId}'s ${row.cause} run was still pending at the sweep`,
          aggregateId: row.id,
        });
      }
      return due.length;
    });
  }

  async findOneForSystem(id: string): Promise<Option<AutomationRunEntity>> {
    const record = await this.repository.findOneBy({ id });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findOneBySessionForSystem(sessionId: string): Promise<Option<AutomationRunEntity>> {
    const record = await this.repository.findOneBy({ sessionId });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async save(run: AutomationRunEntity): Promise<void> {
    const record = this.mapper.toRecord(run);
    await this.outbox.transaction(async (manager) => {
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
      await this.outbox.stageEvents(manager, run.domainEvents);
    });
    run.clearEvents();
  }

  async countLiveForAutomation(
    automationId: string,
    excludingRunId: string,
    since: Date,
  ): Promise<number> {
    return this.countLive(`run."automationId" = $1`, [automationId, excludingRunId, since]);
  }

  async countLiveOnHost(hostId: string, excludingRunId: string, since: Date): Promise<number> {
    return this.countLive(`rev."hostId" = $1`, [hostId, excludingRunId, since]);
  }

  async findLiveDispatchedBefore(before: Date, notBefore: Date, batch: number): Promise<LiveRun[]> {
    const rows: {
      id: string;
      organizationId: string;
      automationId: string;
      sessionId: string;
      dispatchedAt: Date;
    }[] = await this.dataSource.query(
      `SELECT run."id", run."organizationId", run."automationId", run."sessionId", run."dispatchedAt"
         FROM "automation_run" run
         ${LIVE_JOINS}
        WHERE run."outcome" = 'dispatched' AND run."dispatchedAt" < $1
          AND run."dispatchedAt" >= $2 AND ${LIVE_WHERE}
        ORDER BY run."dispatchedAt" LIMIT $3`,
      [before, notBefore, batch],
    );
    return rows.map((row) => ({
      runId: row.id,
      organizationId: row.organizationId,
      automationId: row.automationId,
      sessionId: row.sessionId,
      dispatchedAt: new Date(row.dispatchedAt),
    }));
  }

  /**
   * Reserve the run's slot on its host, or answer that there is none.
   *
   * `decide` weighed the overlap and capacity guards a moment ago, against
   * counts that anything could act on before this run did — and the queue runs
   * four dispatches at once, so all four read the same counts and all four
   * passed. Ten manual runs of an automation capped at one live run started
   * four sessions; the number was the worker count.
   *
   * So the counts are read again here, under the host's lock, and the run
   * writes `claimedAt` before its session exists. A claim counts towards both
   * guards from that moment, so whoever loses the race sees the winner. The run
   * stays `pending`: the reservation is not a state, so every client's view of
   * the run — and "dispatched implies a session" — is untouched.
   *
   * `claimFloor` is how fresh a claim has to be to count, which is what makes a
   * process dying between the claim and the session self-correcting.
   *
   * Nothing here leaves the process, so the lock is held for one count and one
   * update.
   */
  async claimSlot(params: {
    runId: string;
    automationId: string;
    hostId: string;
    liveRunsPerHost: number;
    overlap: string;
    liveSince: Date;
    claimFloor: Date;
    now: Date;
  }): Promise<boolean> {
    return this.outbox.transaction(async (manager) => {
      await lockHostDispatch(manager, params.hostId);
      const countable = `(${LIVE_WHERE} OR (run."outcome" = 'pending' AND run."claimedAt" >= $5))`;
      const [counts]: { automation: string; host: string }[] = await manager.query(
        `SELECT
           count(*) FILTER (WHERE run."automationId" = $1) AS "automation",
           count(*) FILTER (WHERE rev."hostId" = $2) AS "host"
           FROM "automation_run" run
           JOIN "automation_revision" rev ON rev."id" = run."revisionId"
           ${LIVE_JOINS}
          WHERE run."id" <> $3
            AND (run."dispatchedAt" >= $4 OR run."claimedAt" >= $5)
            AND ${countable}`,
        [params.automationId, params.hostId, params.runId, params.liveSince, params.claimFloor],
      );
      if (params.overlap === 'skip' && Number(counts.automation) > 0) return false;
      if (Number(counts.host) >= params.liveRunsPerHost) return false;

      const [, affected]: [unknown[], number] = await manager.query(
        `UPDATE "automation_run" SET "claimedAt" = $2, "updatedAt" = now()
          WHERE "id" = $1 AND "outcome" = 'pending'`,
        [params.runId, params.now],
      );
      return affected > 0;
    });
  }

  private async countLive(where: string, parameters: unknown[]): Promise<number> {
    const [row]: { count: string }[] = await this.dataSource.query(
      `SELECT count(*) AS "count"
         FROM "automation_run" run
         JOIN "automation_revision" rev ON rev."id" = run."revisionId"
         ${LIVE_JOINS}
        WHERE ${where} AND run."id" <> $2 AND run."outcome" = 'dispatched'
          AND run."dispatchedAt" >= $3 AND ${LIVE_WHERE}`,
      parameters,
    );
    return Number(row.count);
  }

  /**
   * The runs the caller can reach under the facets, as a CTE both the page and
   * the counts read. The tenant clause and the window sit on the run itself,
   * so the scan starts at the window, not at the workspace's first run.
   */
  private scopedRuns(scope: AccessScope, filters: Omit<RunFilters, 'statuses'>) {
    const values: unknown[] = [filters.since];
    const where = [`run."createdAt" >= $1`];
    const tenant = runTenantPredicate(scope, values.length + 1);
    if (tenant) {
      values.push(...tenant.values);
      where.push(tenant.clause);
    }
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

  /**
   * One page of the window, and its counts: two statements, the second
   * grouping every status once so the total (the requested statuses) and the
   * tabs' counts (the listed ones) both come from it. Offset pagination,
   * because the contract promises page numbers and a total; over one
   * workspace's window (30 days at most) the offset is cheap. Keyset is the
   * next step if the window ever grows.
   */
  async page(
    scope: AccessScope,
    filters: RunFilters,
    page: number,
    limit: number,
  ): Promise<RunPage> {
    const { cte, values } = this.scopedRuns(scope, filters);
    const statuses = [...(filters.statuses ?? LISTED_RUN_STATUSES)];
    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `${cte} SELECT * FROM runs WHERE "status" = ANY($${values.length + 1})
        ORDER BY "createdAt" DESC, "id" DESC
        LIMIT $${values.length + 2} OFFSET $${values.length + 3}`,
      [...values, statuses, limit, (page - 1) * limit],
    );
    const grouped: { status: string; count: string }[] = await this.dataSource.query(
      `${cte} SELECT "status", count(*) AS "count" FROM runs GROUP BY "status"`,
      values,
    );
    const counted = new Map(grouped.map((row) => [row.status, Number(row.count)]));
    const sum = (of: readonly string[]) =>
      of.reduce((total, status) => total + (counted.get(status) ?? 0), 0);
    return {
      items: rows.map((row) => this.mapper.readModelOf(row)),
      total: sum([...new Set(statuses)]),
      counts: {
        all: sum(LISTED_RUN_STATUSES),
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
