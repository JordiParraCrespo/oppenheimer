import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { None, type Option, Some } from 'oxide.ts';
import { DataSource, type EntityManager, In, Repository, type SelectQueryBuilder } from 'typeorm';
import type { SessionCheckoutEntity } from '../domain/session-checkout.entity';
import type { SessionLaunchImage } from '../domain/session-launch-image.types';
import { SESSION_EVENT_KINDS } from '../domain/session-state.policy';
import type { WorkSessionEntity } from '../domain/work-session.entity';
import {
  payloadBytes,
  SESSION_EVENT_PAYLOAD_MAX_BYTES,
  type WorkSessionEventEntity,
} from '../domain/work-session-event.entity';
import { SessionResource } from '../sessions.resource';
import { type AppendedEventRow, WorkSessionMapper } from '../work-session.mapper';
import { SessionCheckoutOrmEntity } from './session-checkout.orm-entity';
import type { SessionTurnOrmEntity } from './session-turn.orm-entity';
import { WorkSessionOrmEntity } from './work-session.orm-entity';
import type {
  HostSessionRow,
  NewSessionEvent,
  SessionAppendOutcome,
  SessionCreateOutcome,
  SessionEventPage,
  SessionFilters,
  SessionListCursor,
  SessionListPage,
  WorkSessionRepositoryPort,
} from './work-session.repository.port';
import { WorkSessionEventOrmEntity } from './work-session-event.orm-entity';

/**
 * **The append is one transaction, and `seq` is allocated under a row lock.** Every
 * appender takes `SELECT … FOR UPDATE` on the session row first, so they serialise
 * and the log can neither gap nor regress. A batch lands in **one** `INSERT` that
 * skips keys already logged and numbers the rest consecutively; `ON CONFLICT DO
 * NOTHING` is the backstop, not the mechanism. The fold runs over exactly the rows
 * that landed and the row update commits with them, so the sidebar is never
 * eventually-consistent with its own log.
 *
 * **The reads carry no tenant clause of their own**: `ScopedRepositoryBase` with
 * `SessionResource` is the whole of it, so a query and `ability.can()` cannot
 * disagree about a scope. The children are read through their session only.
 */
@Injectable()
export class WorkSessionRepository
  extends ScopedRepositoryBase<WorkSessionOrmEntity>
  implements WorkSessionRepositoryPort
{
  protected readonly resource = SessionResource;
  protected readonly alias = 'session';

  constructor(
    @InjectRepository(WorkSessionOrmEntity)
    protected readonly repository: Repository<WorkSessionOrmEntity>,
    private readonly dataSource: DataSource,
    private readonly mapper: WorkSessionMapper,
    private readonly outbox: OutboxService,
  ) {
    super();
  }

  async createIfUnclaimed(
    session: WorkSessionEntity,
    events: NewSessionEvent[],
  ): Promise<SessionCreateOutcome> {
    const record = this.mapper.toPersistence(session);

    const created = await this.outbox.transaction(async (manager) => {
      // The project is locked **in this transaction**, before the insert, and the
      // archive command takes `FOR UPDATE` on the same row. That is what makes
      // "an archived project holds no unresolved session" true rather than
      // probable: an archive that commits first turns this into zero rows (a
      // locking read re-checks its qualification against the updated row), and an
      // archive that arrives second waits here and then sees the session.
      //
      // The statement names another module's table, which the composite foreign
      // key already does; the lock has to sit in the transaction that inserts, and
      // that transaction is here.
      const active: { id: string }[] = await manager.query(
        `SELECT "id" FROM "project"
          WHERE "id" = $1 AND "organizationId" = $2 AND "archivedAt" IS NULL
          FOR SHARE`,
        [record.projectId, record.organizationId],
      );
      if (active.length === 0) return 'project-archived' as const;
      // The same for the host, whose unpair is an update of this row: an unpair
      // that commits first turns this into zero rows, and one that arrives second
      // waits for the session, which the account's erasure then finds.
      const paired: { id: string }[] = await manager.query(
        `SELECT "id" FROM "host" WHERE "id" = $1 AND "unpairedAt" IS NULL FOR SHARE`,
        [record.hostId],
      );
      if (paired.length === 0) return 'host-unpaired' as const;

      // The conflict target is the client's own key, so the statement itself
      // answers whether this request created the session — no second query that
      // assumes it won, and no second directory and branch on a retry.
      const inserted: { id: string }[] = await manager.query(
        `INSERT INTO "work_session"
           ("id", "organizationId", "projectId", "createdByUserId", "hostId", "name",
            "nameSource", "slug", "agent", "cwdCheckoutId", "idempotencyKey",
            "state", "stateSeq", "agentSessionId", "lastEventAt", "stoppedAt", "origin")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         -- The index is partial, so its predicate has to be repeated or Postgres
         -- cannot infer which constraint is meant.
         ON CONFLICT ("organizationId", "idempotencyKey")
           WHERE "idempotencyKey" IS NOT NULL
           DO NOTHING
         RETURNING "id"`,
        [
          record.id,
          record.organizationId,
          record.projectId,
          record.createdByUserId,
          record.hostId,
          record.name,
          record.nameSource,
          record.slug,
          record.agent,
          // Deliberately null on the insert: the foreign key is
          // `(id, cwdCheckoutId) → session_checkout (sessionId, id)`, so the
          // checkout has to exist first. The fold's update below writes the real
          // value, inside this same transaction.
          null,
          record.idempotencyKey,
          record.state,
          record.stateSeq,
          record.agentSessionId,
          record.lastEventAt,
          record.stoppedAt,
          record.origin,
        ],
      );
      if (inserted.length === 0) return 'taken' as const;

      const checkouts = manager.getRepository(SessionCheckoutOrmEntity);
      for (const checkout of session.checkouts) {
        await checkouts.insert(this.mapper.checkoutToPersistence(checkout));
      }
      // The fold, the row update and the outbox rows all happen in here, in this
      // transaction: the session's first log entries and the columns they produce
      // commit together or not at all.
      await this.appendWithin(manager, session, events);
      return 'created' as const;
    });

    if (created === 'project-archived' || created === 'host-unpaired') {
      return { session, created: false, refused: created };
    }
    if (created === 'taken') {
      const existing: Option<WorkSessionEntity> = session.idempotencyKey
        ? await this.findOneByKeyUnscoped(session.organizationId, session.idempotencyKey)
        : None;
      if (existing.isSome()) {
        return { session: existing.unwrap(), created: false, refused: null };
      }
      // No key to read back by: the insert cannot have been refused for any other
      // reason, so this is a fault rather than a retry.
      throw new Error(`Session ${session.id} was neither inserted nor already present`);
    }

    session.clearEvents();
    return { session, created: true, refused: null };
  }

  async appendEvents(
    session: WorkSessionEntity,
    events: NewSessionEvent[],
  ): Promise<SessionAppendOutcome> {
    const outcome = await this.outbox.transaction((manager) =>
      this.appendWithin(manager, session, events),
    );
    session.clearEvents();
    return outcome;
  }

  async appendEventsForHost(
    hostId: string,
    sessionId: string,
    events: NewSessionEvent[],
  ): Promise<Option<{ session: WorkSessionEntity; outcome: SessionAppendOutcome }>> {
    const appended = await this.outbox.transaction(async (manager) => {
      const locked = await this.lock(manager, sessionId);
      // Missing and somebody else's answer alike, so a host cannot probe for ids.
      if (!locked || locked.hostId !== hostId) return null;
      // The aggregate is built from the locked row, which is what the fold would
      // re-seat onto anyway. Checkouts are loaded only when the batch retires one:
      // the append never writes a checkout, `validate()` does not read them, and
      // `session.checkout_removed` is the one entry whose fold touches them.
      const retires = events.some((event) => event.kind === SESSION_EVENT_KINDS.CHECKOUT_REMOVED);
      const checkouts = retires
        ? await manager.getRepository(SessionCheckoutOrmEntity).find({
            where: { sessionId },
            order: { createdAt: 'ASC' },
          })
        : [];
      const session = this.mapper.toDomain(locked, checkouts);
      const outcome = await this.appendLocked(manager, session, events);
      return { session, outcome };
    });
    if (!appended) return None;
    appended.session.clearEvents();
    return Some(appended);
  }

  async appendMove(
    session: WorkSessionEntity,
    targetProjectId: string,
    events: NewSessionEvent[],
  ): Promise<'moved' | 'project-archived'> {
    const outcome = await this.outbox.transaction(async (manager) => {
      const active: { id: string }[] = await manager.query(
        `SELECT "id" FROM "project"
          WHERE "id" = $1 AND "organizationId" = $2 AND "archivedAt" IS NULL
          FOR SHARE`,
        [targetProjectId, session.organizationId],
      );
      if (active.length === 0) return 'project-archived' as const;
      await this.appendWithin(manager, session, events);
      return 'moved' as const;
    });
    if (outcome === 'moved') session.clearEvents();
    return outcome;
  }

  async insertCheckout(
    session: WorkSessionEntity,
    checkout: SessionCheckoutEntity,
    events: NewSessionEvent[],
  ): Promise<SessionAppendOutcome> {
    const outcome = await this.outbox.transaction(async (manager) => {
      await manager
        .getRepository(SessionCheckoutOrmEntity)
        .insert(this.mapper.checkoutToPersistence(checkout));
      return this.appendWithin(manager, session, events);
    });
    session.clearEvents();
    return outcome;
  }

  async retireCheckout(
    session: WorkSessionEntity,
    checkout: SessionCheckoutEntity,
    events: NewSessionEvent[],
  ): Promise<SessionAppendOutcome> {
    const outcome = await this.outbox.transaction(async (manager) => {
      // The append runs first: folding `session.checkout_removed` is what marks the
      // child and steps the agent out of it, so `removedAt` below is written from
      // what the log said rather than from a value the caller set beside it.
      const appended = await this.appendWithin(manager, session, events);
      await manager
        .getRepository(SessionCheckoutOrmEntity)
        .update({ id: checkout.id }, { removedAt: checkout.removedAt ?? new Date() });
      return appended;
    });
    session.clearEvents();
    return outcome;
  }

  async findAllPaginated(scope: AccessScope, filters: SessionFilters): Promise<SessionListPage> {
    const query = this.scopedQuery(scope);
    if (filters.projectId) query.andWhere('session.projectId = :projectId', filters);
    if (filters.hostId) query.andWhere('session.hostId = :hostId', filters);
    if (filters.state) query.andWhere('session.state = :state', filters);
    if (filters.agent) query.andWhere('session.agent = :agent', filters);
    if (filters.githubRepoId !== undefined) {
      // A live checkout of the repository. The child table is read by the
      // session ids the scoped root query already admits, never on its own.
      query.andWhere(
        `EXISTS (SELECT 1 FROM "session_checkout" checkout
                  WHERE checkout."sessionId" = session.id
                    AND checkout."githubRepoId" = :githubRepoId
                    AND checkout."removedAt" IS NULL)`,
        { githubRepoId: String(filters.githubRepoId) },
      );
    }
    const sort = filters.sort ?? 'recent';
    const key = SORT_KEYS[sort];
    applySort(query, sort);
    // The sort key as Postgres prints it, for the next cursor: text round-trips a
    // `timestamptz` to the microsecond, which a JavaScript `Date` does not.
    query.addSelect(`(${key.expression})::text`, 'sortKey');

    if (filters.cursor) {
      // A row comparison, so the walk resumes exactly after the last row it
      // returned and never counts: `(key, id)` is unique and both halves sort in
      // the same direction.
      query.andWhere(
        `(${key.expression}, "session"."id") ${key.after} (CAST(:cursorKey AS ${key.type}), CAST(:cursorId AS uuid))`,
        { cursorKey: filters.cursor.key, cursorId: filters.cursor.id },
      );
      // One more than asked for, so "is there another page" needs no count.
      const rows = await this.pageOf(query.limit(filters.limit + 1));
      const page = rows.slice(0, filters.limit);
      return {
        data: await this.withCheckoutsAll(page.map((row) => row.record)),
        limit: filters.limit,
        nextCursor: rows.length > filters.limit ? cursorAfter(sort, page) : null,
      };
    }

    const [total, rows] = await Promise.all([
      query.clone().getCount(),
      this.pageOf(query.offset((filters.page - 1) * filters.limit).limit(filters.limit)),
    ]);
    return {
      data: await this.withCheckoutsAll(rows.map((row) => row.record)),
      limit: filters.limit,
      total,
      page: filters.page,
      nextCursor: filters.page * filters.limit < total ? cursorAfter(sort, rows) : null,
    };
  }

  async findOneById(scope: AccessScope, id: string): Promise<Option<WorkSessionEntity>> {
    const record = await this.scopedQuery(scope).andWhere('session.id = :id', { id }).getOne();
    return this.withCheckouts(record);
  }

  async findOneByIdempotencyKey(
    scope: AccessScope,
    key: string,
  ): Promise<Option<WorkSessionEntity>> {
    const record = await this.scopedQuery(scope)
      .andWhere('session.idempotencyKey = :key', { key })
      .getOne();
    return this.withCheckouts(record);
  }

  async findOneByIdForMachine(id: string): Promise<Option<WorkSessionEntity>> {
    const record = await this.unscopedQuery(
      'a runner reports about a session on the host it proved it is; there is no person on the request to scope by, and the caller checks the session belongs to that host',
    )
      .where('session.id = :id', { id })
      .getOne();
    return this.withCheckouts(record);
  }

  async findUnresolvedForHostForMachine(hostId: string): Promise<HostSessionRow[]> {
    const records = await this.unscopedQuery(
      "the link reconciles a host's hello against what this host should hold; the host proved who it is with a signature and there is no person on the frame",
    )
      .where('session.hostId = :hostId', { hostId })
      .andWhere('session.state IN (:...states)', { states: ['starting', 'open'] })
      .orderBy('session.createdAt', 'ASC')
      .getMany();
    if (records.length === 0) return [];

    const ids = records.map((record) => record.id);
    const [checkouts, prompts] = await Promise.all([
      this.checkoutsFor(ids),
      this.repository.manager.getRepository(WorkSessionEventOrmEntity).find({
        where: { sessionId: In(ids), kind: SESSION_EVENT_KINDS.PROMPT_FIRST },
        select: { sessionId: true, payload: true },
      }),
    ]);
    const firstPrompts = new Map<string, { prompt: string; images: SessionLaunchImage[] }>();
    for (const event of prompts) {
      const text = (event.payload as { text?: unknown } | null)?.text;
      if (typeof text === 'string' && !firstPrompts.has(event.sessionId)) {
        firstPrompts.set(event.sessionId, {
          prompt: text,
          images: WorkSessionMapper.imagesOf(event.payload),
        });
      }
    }
    return records.flatMap((record) => {
      const first = firstPrompts.get(record.id);
      return [
        {
          session: this.mapper.toDomain(record, checkouts.get(record.id) ?? []),
          ...(first ? { prompt: first.prompt } : {}),
          ...(first?.images.length ? { images: first.images } : {}),
        },
      ];
    });
  }

  async findRunningOnHostForSystem(hostId: string): Promise<WorkSessionEntity[]> {
    const records = await this.running(
      'a removed host stops whatever runs on it, and there is no person on a domain event to scope by',
    )
      .andWhere('session.hostId = :hostId', { hostId })
      .orderBy('session.createdAt', 'ASC')
      .getMany();
    if (records.length === 0) return [];
    const checkouts = await this.checkoutsFor(records.map((record) => record.id));
    return records.map((record) => this.mapper.toDomain(record, checkouts.get(record.id) ?? []));
  }

  async countRunningByHost(hostIds: readonly string[]): Promise<Map<string, number>> {
    if (hostIds.length === 0) return new Map();
    const rows: { hostId: string; count: string }[] = await this.running(
      'the hosts were read under the caller’s scope already, and this returns a count per host rather than a row',
    )
      .andWhere('session.hostId IN (:...hostIds)', { hostIds: [...hostIds] })
      .select('session.hostId', 'hostId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('session.hostId')
      .getRawMany();
    return new Map(rows.map((row) => [row.hostId, Number(row.count)]));
  }

  async eraseWorkspace(organizationId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // The locks the writers take, in their order and in id order: the projects
      // a create or a move holds `FOR SHARE`, then the rows an append holds.
      await manager.query(
        `SELECT "id" FROM "project" WHERE "organizationId" = $1 ORDER BY "id" FOR UPDATE`,
        [organizationId],
      );
      await manager.query(
        `SELECT "id" FROM "work_session" WHERE "organizationId" = $1 ORDER BY "id" FOR UPDATE`,
        [organizationId],
      );
      // Children first: the log and the checkouts refuse to lose their session.
      await manager
        .createQueryBuilder()
        .delete()
        .from(WorkSessionEventOrmEntity)
        .where(
          `"sessionId" IN (SELECT "id" FROM "work_session" WHERE "organizationId" = :organizationId)`,
          { organizationId },
        )
        .execute();
      await manager.delete(SessionCheckoutOrmEntity, { organizationId });
      await manager.delete(WorkSessionOrmEntity, { organizationId });
    });
  }

  async findEvents(
    session: WorkSessionEntity,
    afterSeq: number | undefined,
    limit: number,
  ): Promise<SessionEventPage> {
    const sessionId = session.id;
    const query = this.repository.manager
      .getRepository(WorkSessionEventOrmEntity)
      .createQueryBuilder('event')
      .where('event.sessionId = :sessionId', { sessionId })
      .orderBy('event.seq', 'ASC')
      // One more than asked for, so "is there another page" needs no second count
      // over a table that only ever grows.
      .take(limit + 1);
    if (afterSeq !== undefined) query.andWhere('event.seq > :afterSeq', { afterSeq });

    const records = await query.getMany();
    const page = records.slice(0, limit);
    return {
      events: page.map((record) => this.mapper.eventToDomain(record)),
      nextSeq: records.length > limit ? (page[page.length - 1]?.seq ?? null) : null,
    };
  }

  async countUnresolvedForProject(scope: AccessScope, projectId: string): Promise<number> {
    return this.scopedQuery(scope)
      .andWhere('session.projectId = :projectId', { projectId })
      .andWhere("session.state <> 'resolved'")
      .getCount();
  }

  /**
   * The append itself, inside whatever transaction the caller owns: the lock, the
   * rows, the fold, the row update and the outbox entries the fold owes.
   */
  private async appendWithin(
    manager: EntityManager,
    session: WorkSessionEntity,
    events: NewSessionEvent[],
  ): Promise<SessionAppendOutcome> {
    const locked = await this.lock(manager, session.id);
    if (!locked) {
      throw new Error(`Session ${session.id} disappeared while appending to its log`);
    }
    // Fold onto what the **locked row** says, not onto the instance the caller
    // loaded. Two requests can hold separate aggregates: a close commits
    // `resolved` while a stop waits here, and folding onto the stop's stale `open`
    // would write a projection the log does not support. The lock is what makes
    // this read final.
    session.reseatFold(this.mapper.foldOf(locked));
    return this.appendLocked(manager, session, events);
  }

  /** `SELECT … FOR UPDATE` on the session row; null when there is no such row. */
  private async lock(
    manager: EntityManager,
    sessionId: string,
  ): Promise<WorkSessionOrmEntity | null> {
    const locked: WorkSessionOrmEntity[] = await manager.query(
      `SELECT * FROM "work_session" WHERE "id" = $1 FOR UPDATE`,
      [sessionId],
    );
    return locked[0] ?? null;
  }

  /**
   * Everything after the lock, for an aggregate whose fold is the locked row's:
   * the latest turn, the one `INSERT` for the batch, the fold over what landed,
   * the row update, the turns and the outbox.
   */
  private async appendLocked(
    manager: EntityManager,
    session: WorkSessionEntity,
    events: NewSessionEvent[],
  ): Promise<SessionAppendOutcome> {
    const rejected: SessionAppendOutcome['rejected'] = [];

    // The latest turn is folded like the row, so it is read under the same lock.
    const [latestTurn]: SessionTurnOrmEntity[] = await manager.query(
      `SELECT * FROM "session_turn" WHERE "sessionId" = $1 ORDER BY "seq" DESC LIMIT 1`,
      [session.id],
    );
    session.reseatLatestTurn(latestTurn ? this.mapper.turnToDomain(latestTurn) : null);

    const candidates = events.filter((event) => {
      if (payloadBytes(event.payload) <= SESSION_EVENT_PAYLOAD_MAX_BYTES) return true;
      rejected.push({
        idempotencyKey: event.idempotencyKey,
        reason: `payload is over ${SESSION_EVENT_PAYLOAD_MAX_BYTES} bytes`,
      });
      return false;
    });
    // A key twice in one batch lands once, as its first occurrence: the statement
    // below must not conflict with itself, and the second copy is "already
    // durable" to its writer like any replay.
    const seen = new Set<string>();
    const fresh = candidates.filter((event) => {
      if (seen.has(event.idempotencyKey)) return false;
      seen.add(event.idempotencyKey);
      return true;
    });
    // Every key that was not refused is accepted: it landed now, or an earlier
    // attempt landed it. `DO NOTHING` cannot tell those apart, and for the writer
    // both mean the same thing: stop resending it.
    const accepted = candidates.map((event) => event.idempotencyKey);

    const appended = fresh.length > 0 ? await this.insertBatch(manager, session.id, fresh) : [];
    for (const entity of appended) {
      session.recordEvent({
        seq: entity.seq,
        kind: entity.kind,
        payload: entity.payload,
        occurredAt: entity.occurredAt,
      });
    }

    if (appended.length > 0) {
      // **Every column the fold projects**, and nothing else. The list is the
      // one in `SessionFold`, spelled once: a hand-picked subset here is a
      // column the fold silently stops maintaining, which is what happened to
      // the four observation columns — the inputs the sidebar's own debounce
      // reads — and then to the launch options. The row is the projection or it
      // is a second truth.
      const record = this.mapper.toPersistence(session);
      await manager.query(
        `UPDATE "work_session"
            SET "state" = $2, "stateSeq" = $3, "agentSessionId" = $4, "lastEventAt" = $5,
                "stoppedAt" = $6, "name" = $7, "nameSource" = $8, "cwdCheckoutId" = $9,
                "lastObservedState" = $10, "observedSince" = $11,
                "reportHash" = $12, "ackedReportHash" = $13,
                "launchModel" = $14, "launchPermission" = $15, "launchEffort" = $16,
                "projectId" = $17,
                "updatedAt" = now()
          WHERE "id" = $1`,
        [
          record.id,
          record.state,
          record.stateSeq,
          record.agentSessionId,
          record.lastEventAt,
          record.stoppedAt,
          record.name,
          record.nameSource,
          record.cwdCheckoutId,
          record.lastObservedState,
          record.observedSince,
          record.reportHash,
          record.ackedReportHash,
          record.launchModel,
          record.launchPermission,
          record.launchEffort,
          record.projectId,
        ],
      );
      await this.writeTurns(manager, session);
      await this.outbox.stageEvents(manager, session.domainEvents);
    }

    return { accepted, rejected, appended };
  }

  /**
   * The batch in **one statement**: skip the keys already logged, number the rest
   * after the current maximum in the caller's order, insert them, and return the new
   * entries in `seq` order.
   *
   * It must run **after** the `FOR UPDATE` statement has returned, never folded into
   * it. Under READ COMMITTED a statement's snapshot is taken before it blocks on a row
   * lock, so a `MAX("seq")` in the locking statement would miss the appender ahead of
   * us, and every waiter would allocate the same numbers. Started once the lock is
   * held, its `MAX`, "already present" check and insert all read one snapshot that
   * sees every earlier appender.
   *
   * Under the lock nobody else inserts this session's keys and the batch has no
   * duplicates, so `ON CONFLICT` should never fire; if it did, `seq` would gap, so a
   * short count throws and the transaction rolls back.
   */
  private async insertBatch(
    manager: EntityManager,
    sessionId: string,
    events: NewSessionEvent[],
  ): Promise<WorkSessionEventEntity[]> {
    const rows: AppendedEventRow[] = await manager.query(
      `WITH input AS (
         SELECT e."ord", e."idempotencyKey", e."source", e."kind", e."payload", e."occurredAt"
           FROM jsonb_to_recordset($2::jsonb)
             AS e("ord" integer, "idempotencyKey" text, "source" text, "kind" text,
                  "payload" jsonb, "occurredAt" timestamptz)
       ),
       fresh AS (
         SELECT i.* FROM input i
          WHERE NOT EXISTS (SELECT 1 FROM "work_session_event" x
                             WHERE x."sessionId" = $1 AND x."idempotencyKey" = i."idempotencyKey")
       ),
       base AS (
         SELECT COALESCE(MAX("seq"), 0) AS "seq" FROM "work_session_event" WHERE "sessionId" = $1
       ),
       landed AS (
         INSERT INTO "work_session_event"
           ("sessionId", "seq", "idempotencyKey", "source", "kind", "payload", "occurredAt")
         SELECT $1, base."seq" + row_number() OVER (ORDER BY f."ord"),
                f."idempotencyKey", f."source", f."kind", f."payload", f."occurredAt"
           FROM fresh f CROSS JOIN base
         ON CONFLICT ("sessionId", "idempotencyKey") DO NOTHING
         RETURNING "id", "seq", "idempotencyKey", "source", "kind", "payload",
                   "occurredAt", "recordedAt"
       )
       -- One row even when nothing landed, so the count of what should have is
       -- always there to check against.
       SELECT (SELECT count(*) FROM fresh)::integer AS "expected", landed.*
         FROM (SELECT 1) AS one LEFT JOIN landed ON true
        ORDER BY landed."seq"`,
      [sessionId, this.mapper.toAppendRecordset(events)],
    );
    const landed = rows.filter((row) => row.id !== null);
    const expected = rows[0]?.expected ?? 0;
    if (landed.length !== expected) {
      throw new Error(
        `Session ${sessionId}: ${expected} new log entries were numbered but ${landed.length} landed`,
      );
    }
    return landed.map((row) => this.mapper.appendedToDomain(sessionId, row));
  }

  /**
   * Write back the turns this append's folds moved: an upsert on
   * `(sessionId, seq)`, because a fold both opens turns and moves them.
   */
  private async writeTurns(manager: EntityManager, session: WorkSessionEntity): Promise<void> {
    for (const turn of session.takeChangedTurns()) {
      const row = this.mapper.turnToPersistence(session, turn);
      await manager.query(
        `INSERT INTO "session_turn"
           ("organizationId", "sessionId", "seq", "origin", "drive", "state", "prompt",
            "observedWorking", "startedAt", "endedAt", "exitCode", "agentSessionId",
            "result", "failureDetail", "costUsd", "permissionDenials", "outputRef")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT ("sessionId", "seq") DO UPDATE SET
           "drive" = EXCLUDED."drive", "state" = EXCLUDED."state",
           "prompt" = EXCLUDED."prompt", "observedWorking" = EXCLUDED."observedWorking",
           "startedAt" = EXCLUDED."startedAt", "endedAt" = EXCLUDED."endedAt",
           "exitCode" = EXCLUDED."exitCode", "agentSessionId" = EXCLUDED."agentSessionId",
           "result" = EXCLUDED."result", "failureDetail" = EXCLUDED."failureDetail",
           "costUsd" = EXCLUDED."costUsd", "permissionDenials" = EXCLUDED."permissionDenials",
           "outputRef" = EXCLUDED."outputRef", "updatedAt" = now()`,
        [
          row.organizationId,
          row.sessionId,
          row.seq,
          row.origin,
          row.drive,
          row.state,
          row.prompt,
          row.observedWorking,
          row.startedAt,
          row.endedAt,
          row.exitCode,
          row.agentSessionId,
          row.result,
          row.failureDetail,
          row.costUsd,
          row.permissionDenials,
          row.outputRef,
        ],
      );
    }
  }

  /** A page of rows with the sort key each was selected with, in the query's order. */
  private async pageOf(
    query: SelectQueryBuilder<WorkSessionOrmEntity>,
  ): Promise<{ record: WorkSessionOrmEntity; sortKey: string }[]> {
    const { entities, raw } = await query.getRawAndEntities<{
      session_id: string;
      sortKey: string;
    }>();
    const keys = new Map(raw.map((row) => [row.session_id, row.sortKey]));
    return entities.map((record) => ({ record, sortKey: keys.get(record.id) ?? '' }));
  }

  private async withCheckoutsAll(records: WorkSessionOrmEntity[]): Promise<WorkSessionEntity[]> {
    const checkouts = await this.checkoutsFor(records.map((record) => record.id));
    return records.map((record) => this.mapper.toDomain(record, checkouts.get(record.id) ?? []));
  }

  private async withCheckouts(
    record: WorkSessionOrmEntity | null,
  ): Promise<Option<WorkSessionEntity>> {
    if (!record) return None as Option<WorkSessionEntity>;
    const checkouts = await this.checkoutsFor([record.id]);
    return Some(this.mapper.toDomain(record, checkouts.get(record.id) ?? []));
  }

  private async findOneByKeyUnscoped(
    organizationId: string,
    idempotencyKey: string,
  ): Promise<Option<WorkSessionEntity>> {
    const record = await this.unscopedQuery(
      'the retry path of a create: the caller has already been scoped to this workspace by the command that reached here, and the key is only unique within it',
    )
      .where('session.organizationId = :organizationId', { organizationId })
      .andWhere('session.idempotencyKey = :idempotencyKey', { idempotencyKey })
      .getOne();
    return this.withCheckouts(record);
  }

  /**
   * "Running" as the host list and host removal mean it: the agent is up, so
   * the lifecycle is `starting` or `open` and nobody has stopped it. Served by
   * `IDX_work_session_host_state`.
   */
  private running(reason: string) {
    return this.unscopedQuery(reason)
      .where('session.state IN (:...runningStates)', { runningStates: ['starting', 'open'] })
      .andWhere('session.stoppedAt IS NULL');
  }

  /** Checkouts for a page of sessions, in one query rather than one per row. */
  private async checkoutsFor(
    sessionIds: string[],
  ): Promise<Map<string, SessionCheckoutOrmEntity[]>> {
    const byId = new Map<string, SessionCheckoutOrmEntity[]>();
    if (sessionIds.length === 0) return byId;
    const records = await this.repository.manager
      .getRepository(SessionCheckoutOrmEntity)
      .createQueryBuilder('checkout')
      .where('checkout.sessionId IN (:...sessionIds)', { sessionIds })
      .orderBy('checkout.createdAt', 'ASC')
      .getMany();
    for (const record of records) {
      const existing = byId.get(record.sessionId);
      if (existing) existing.push(record);
      else byId.set(record.sessionId, [record]);
    }
    return byId;
  }
}

/**
 * Each order's sort key: the expression, the type its printed text casts back to, and
 * which side of the cursor the next page is on. Both halves of `(key, id)` sort the
 * same way, so one row comparison resumes a walk.
 *
 * No index serves these, deliberately: `lastEventAt` is rewritten by every fold, and
 * an index on it would make every append a non-HOT update of `work_session`. A page is
 * a top-N sort over one workspace's sessions (found by the organization prefix of
 * `UQ_work_session_organization_slug`), a few thousand rows at most, sorted in memory
 * in well under a millisecond.
 */
const SORT_KEYS: Record<
  NonNullable<SessionFilters['sort']>,
  { expression: string; type: 'timestamptz' | 'text'; after: '<' | '>' }
> = {
  recent: {
    expression: 'COALESCE("session"."lastEventAt", "session"."createdAt")',
    type: 'timestamptz',
    after: '<',
  },
  oldest: { expression: '"session"."createdAt"', type: 'timestamptz', after: '>' },
  name: { expression: 'LOWER("session"."name")', type: 'text', after: '>' },
};

/**
 * The list's order. `recent` is last activity first, with sessions nothing has
 * happened in yet by their creation; the id breaks every tie so a page boundary
 * is stable. The tie-break runs the same way as the key — descending for
 * `recent`, ascending otherwise — because that is what lets one row comparison
 * resume a cursor walk. It only ever orders sessions whose key is equal, so no
 * caller depends on which way it runs.
 */
function applySort(
  query: SelectQueryBuilder<WorkSessionOrmEntity>,
  sort: NonNullable<SessionFilters['sort']>,
): void {
  const direction = SORT_KEYS[sort].after === '<' ? 'DESC' : 'ASC';
  query.orderBy(SORT_KEYS[sort].expression, direction).addOrderBy('session.id', direction);
}

/** The cursor that resumes after the last row of a page; null for an empty one. */
function cursorAfter(
  sort: NonNullable<SessionFilters['sort']>,
  rows: { record: WorkSessionOrmEntity; sortKey: string }[],
): SessionListCursor | null {
  const last = rows[rows.length - 1];
  return last ? { sort, key: last.sortKey, id: last.record.id } : null;
}
