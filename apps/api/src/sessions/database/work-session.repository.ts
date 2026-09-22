import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { OutboxService, Paginated } from '@oppenheimer/backend-ddd';
import { None, type Option, Some } from 'oxide.ts';
import { DataSource, type EntityManager, In, Repository } from 'typeorm';
import { ProjectOrmEntity } from '../../projects/database/project.orm-entity';
import type { SessionCheckoutEntity } from '../domain/session-checkout.entity';
import { SESSION_EVENT_KINDS } from '../domain/session-state.policy';
import type { WorkSessionEntity } from '../domain/work-session.entity';
import {
  payloadBytes,
  SESSION_EVENT_PAYLOAD_MAX_BYTES,
  WorkSessionEventEntity,
} from '../domain/work-session-event.entity';
import { SessionResource } from '../sessions.resource';
import { WorkSessionMapper } from '../work-session.mapper';
import { SessionCheckoutOrmEntity } from './session-checkout.orm-entity';
import { WorkSessionOrmEntity } from './work-session.orm-entity';
import type {
  HostSessionRow,
  NewSessionEvent,
  SessionAppendOutcome,
  SessionEventPage,
  SessionFilters,
  WorkSessionRepositoryPort,
} from './work-session.repository.port';
import { WorkSessionEventOrmEntity } from './work-session-event.orm-entity';

/**
 * TypeORM adapter for the work-session aggregate.
 *
 * Two things are worth reading closely.
 *
 * **The append is one transaction, and `seq` is allocated under a row lock.**
 * Every appender takes `SELECT … FOR UPDATE` on the session row first, so they
 * serialise: the log cannot develop a gap, and it cannot regress. Keys already in
 * the log are read inside that lock and skipped, so a replayed batch appends only
 * what was not yet seen and the remaining rows still get consecutive numbers — the
 * per-row `ON CONFLICT DO NOTHING` stays as the backstop rather than as the
 * mechanism. The fold runs over exactly the rows that landed and the row update
 * commits with them, so the sidebar is never eventually-consistent with its own log.
 *
 * **The reads carry no tenant clause of their own.** Extending
 * `ScopedRepositoryBase` and naming `SessionResource` is the whole of it, so a query
 * and an `ability.can()` cannot disagree about what a scope means. The children are
 * read through their session, never on their own.
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
  ): Promise<{ session: WorkSessionEntity; created: boolean; projectArchived: boolean }> {
    const record = this.mapper.toPersistence(session);

    const created = await this.dataSource.transaction(async (manager) => {
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

      // The conflict target is the client's own key, so the statement itself
      // answers whether this request created the session — no second query that
      // assumes it won, and no second directory and branch on a retry.
      const inserted: { id: string }[] = await manager.query(
        `INSERT INTO "work_session"
           ("id", "organizationId", "projectId", "createdByUserId", "hostId", "name",
            "nameSource", "slug", "agent", "cwdCheckoutId", "idempotencyKey",
            "state", "stateSeq", "agentSessionId", "lastEventAt", "stoppedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
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

    if (created === 'project-archived') return { session, created: false, projectArchived: true };
    if (created === 'taken') {
      const existing: Option<WorkSessionEntity> = session.idempotencyKey
        ? await this.findOneByKeyUnscoped(session.organizationId, session.idempotencyKey)
        : None;
      if (existing.isSome()) {
        return { session: existing.unwrap(), created: false, projectArchived: false };
      }
      // No key to read back by: the insert cannot have been refused for any other
      // reason, so this is a fault rather than a retry.
      throw new Error(`Session ${session.id} was neither inserted nor already present`);
    }

    session.clearEvents();
    await this.outbox.wake();
    return { session, created: true, projectArchived: false };
  }

  async appendEvents(
    session: WorkSessionEntity,
    events: NewSessionEvent[],
  ): Promise<SessionAppendOutcome> {
    const outcome = await this.dataSource.transaction((manager) =>
      this.appendWithin(manager, session, events),
    );
    await this.flushEvents(session);
    return outcome;
  }

  async insertCheckout(
    session: WorkSessionEntity,
    checkout: SessionCheckoutEntity,
    events: NewSessionEvent[],
  ): Promise<SessionAppendOutcome> {
    const outcome = await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(SessionCheckoutOrmEntity)
        .insert(this.mapper.checkoutToPersistence(checkout));
      return this.appendWithin(manager, session, events);
    });
    await this.flushEvents(session);
    return outcome;
  }

  async retireCheckout(
    session: WorkSessionEntity,
    checkout: SessionCheckoutEntity,
    events: NewSessionEvent[],
  ): Promise<SessionAppendOutcome> {
    const outcome = await this.dataSource.transaction(async (manager) => {
      // The append runs first: folding `session.checkout_removed` is what marks the
      // child and steps the agent out of it, so `removedAt` below is written from
      // what the log said rather than from a value the caller set beside it.
      const appended = await this.appendWithin(manager, session, events);
      await manager
        .getRepository(SessionCheckoutOrmEntity)
        .update({ id: checkout.id }, { removedAt: checkout.removedAt ?? new Date() });
      return appended;
    });
    await this.flushEvents(session);
    return outcome;
  }

  async findAllPaginated(
    scope: AccessScope,
    filters: SessionFilters,
  ): Promise<Paginated<WorkSessionEntity>> {
    const query = this.scopedQuery(scope);
    if (filters.projectId) query.andWhere('session.projectId = :projectId', filters);
    if (filters.hostId) query.andWhere('session.hostId = :hostId', filters);
    if (filters.state) query.andWhere('session.state = :state', filters);

    const [records, count] = await query
      .orderBy('session.createdAt', 'DESC')
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit)
      .getManyAndCount();

    const checkouts = await this.checkoutsFor(records.map((record) => record.id));
    return new Paginated({
      count,
      page: filters.page,
      limit: filters.limit,
      data: records.map((record) => this.mapper.toDomain(record, checkouts.get(record.id) ?? [])),
    });
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
    const [checkouts, projects, prompts] = await Promise.all([
      this.checkoutsFor(ids),
      this.repository.manager.getRepository(ProjectOrmEntity).find({
        where: { id: In([...new Set(records.map((record) => record.projectId))]) },
        select: { id: true, slug: true },
      }),
      this.repository.manager.getRepository(WorkSessionEventOrmEntity).find({
        where: { sessionId: In(ids), kind: SESSION_EVENT_KINDS.PROMPT_FIRST },
        select: { sessionId: true, payload: true },
      }),
    ]);
    const slugs = new Map(projects.map((project) => [project.id, project.slug]));
    const firstPrompts = new Map<string, string>();
    for (const event of prompts) {
      const text = (event.payload as { text?: unknown } | null)?.text;
      if (typeof text === 'string' && !firstPrompts.has(event.sessionId)) {
        firstPrompts.set(event.sessionId, text);
      }
    }
    return records.flatMap((record) => {
      const projectSlug = slugs.get(record.projectId);
      if (!projectSlug) return [];
      const prompt = firstPrompts.get(record.id);
      return [
        {
          session: this.mapper.toDomain(record, checkouts.get(record.id) ?? []),
          projectSlug,
          ...(prompt ? { prompt } : {}),
        },
      ];
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
   *
   * `FOR UPDATE` on the session row is what serialises appenders. The keys already
   * in the log are read under that lock, so the rows that are genuinely new get
   * consecutive `seq` values and the fold runs over exactly those.
   */
  private async appendWithin(
    manager: EntityManager,
    session: WorkSessionEntity,
    events: NewSessionEvent[],
  ): Promise<SessionAppendOutcome> {
    const accepted: string[] = [];
    const rejected: SessionAppendOutcome['rejected'] = [];
    const appended: WorkSessionEventEntity[] = [];

    const locked: WorkSessionOrmEntity[] = await manager.query(
      `SELECT * FROM "work_session" WHERE "id" = $1 FOR UPDATE`,
      [session.id],
    );
    if (locked.length === 0) {
      throw new Error(`Session ${session.id} disappeared while appending to its log`);
    }
    // Fold onto what the **locked row** says, not onto the instance the caller
    // loaded. Two requests can hold separate aggregates: a close commits
    // `resolved` while a stop waits here, and folding onto the stop's stale `open`
    // would write a projection the log does not support. The lock is what makes
    // this read final.
    session.reseatFold(this.mapper.foldOf(locked[0]));

    // A **second** statement, deliberately. Under READ COMMITTED a statement's
    // snapshot is taken before it blocks on a row lock, so reading the maximum in
    // the same statement as the `FOR UPDATE` returns the value from before the
    // appender ahead of us committed — and every waiter would allocate the same
    // numbers. Once the lock is held, a fresh statement sees their rows.
    const [{ maxSeq }]: { maxSeq: number | null }[] = await manager.query(
      `SELECT MAX("seq") AS "maxSeq" FROM "work_session_event" WHERE "sessionId" = $1`,
      [session.id],
    );
    let seq = Number(maxSeq ?? 0);

    const candidates = events.filter((event) => {
      if (payloadBytes(event.payload) <= SESSION_EVENT_PAYLOAD_MAX_BYTES) return true;
      rejected.push({
        idempotencyKey: event.idempotencyKey,
        reason: `payload is over ${SESSION_EVENT_PAYLOAD_MAX_BYTES} bytes`,
      });
      return false;
    });

    const present = await this.existingKeys(
      manager,
      session.id,
      candidates.map((event) => event.idempotencyKey),
    );

    for (const event of candidates) {
      if (present.has(event.idempotencyKey)) {
        // Already durable from an earlier attempt. `DO NOTHING` cannot tell this
        // apart from a row it just wrote, and for the writer both mean the same
        // thing: stop resending it.
        accepted.push(event.idempotencyKey);
        continue;
      }
      seq += 1;
      const entity = WorkSessionEventEntity.createNew({
        sessionId: session.id,
        seq,
        idempotencyKey: event.idempotencyKey,
        source: event.source,
        kind: event.kind,
        payload: event.payload,
        occurredAt: event.occurredAt,
      });
      const events = manager.getRepository(WorkSessionEventOrmEntity);
      const landed = await events
        .createQueryBuilder()
        .insert()
        // Cast around TypeORM's `QueryDeepPartialEntity` recursion, which cannot
        // represent the free-form `payload` jsonb.
        .values(this.mapper.eventToPersistence(entity) as Parameters<typeof events.insert>[0])
        .orIgnore(`("sessionId", "idempotencyKey")`)
        .returning(['id'])
        .execute();
      if (landed.raw.length === 0) {
        // Somebody appended this key between the read and the insert. Nothing
        // landed, so the number is handed back rather than skipped.
        seq -= 1;
        accepted.push(event.idempotencyKey);
        continue;
      }
      accepted.push(event.idempotencyKey);
      appended.push(entity);
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
        ],
      );
      await this.outbox.stageEvents(manager, session.domainEvents);
    }

    return { accepted, rejected, appended };
  }

  private async existingKeys(
    manager: EntityManager,
    sessionId: string,
    keys: string[],
  ): Promise<Set<string>> {
    if (keys.length === 0) return new Set();
    const rows: { idempotencyKey: string }[] = await manager.query(
      `SELECT "idempotencyKey" FROM "work_session_event"
        WHERE "sessionId" = $1 AND "idempotencyKey" = ANY($2::text[])`,
      [sessionId, keys],
    );
    return new Set(rows.map((row) => row.idempotencyKey));
  }

  /** The events staged inside the transaction are owed a wake once it commits. */
  private async flushEvents(session: WorkSessionEntity): Promise<void> {
    if (session.domainEvents.length === 0) return;
    session.clearEvents();
    await this.outbox.wake();
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
