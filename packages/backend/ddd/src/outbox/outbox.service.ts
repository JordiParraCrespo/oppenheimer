import type { DataSource, EntityManager } from 'typeorm';
import type { DomainEvent } from '../domain-event.base';
import { RequestContextService } from '../request-context.service';
import {
  OUTBOX_TABLE,
  type OutboxChannel,
  type OutboxMessageRecord,
  OutboxMessageSchema,
  type OutboxMessageStatus,
} from './outbox-message';

export interface OutboxServiceOptions {
  /** Attempts before a row is parked as `failed` for inspection. */
  maxAttempts?: number;
  /** First retry delay; doubles per attempt. */
  baseRetryDelayMs?: number;
  /** Ceiling for the exponential backoff. */
  maxRetryDelayMs?: number;
  logger?: { warn(message: string): void };
}

export interface StageJobParams {
  /** BullMQ queue name the relay should hand this row to. */
  queue: string;
  jobName: string;
  payload: Record<string, unknown>;
  /** Why this job is owed — recorded on the row so it is self-explaining. */
  reason: string;
  aggregateId?: string;
  /** Defaults to the request context's correlation id, so a job stays traceable to the request that owed it. */
  correlationId?: string;
  /** Earliest delivery time; defaults to now. */
  availableAt?: Date;
}

export interface ClaimOptions {
  batchSize?: number;
  /** Lease duration; a claim whose owner dies is reclaimable after this. */
  leaseMs?: number;
}

/**
 * The slice of `AggregateRoot` that `writeWithEvents` needs: any aggregate
 * that collects domain events and can be told they were taken over.
 */
export interface EventfulAggregate {
  readonly domainEvents: readonly DomainEvent[];
  clearEvents(): void;
}

const DEFAULT_MAX_ATTEMPTS = 8;
const DEFAULT_BASE_RETRY_DELAY_MS = 5_000;
const DEFAULT_MAX_RETRY_DELAY_MS = 15 * 60_000;
const DEFAULT_BATCH_SIZE = 20;
/** Lease a claim holds before another relay may take the row; the relay renews it while it delivers. */
export const DEFAULT_LEASE_MS = 30_000;

/**
 * Transactional outbox: side effects (domain events, queued jobs) are written
 * as rows **inside the same transaction** as the state change that owes them,
 * closing the `commit(); enqueue();` window in which a Redis blip or a killed
 * process silently loses the side effect.
 *
 * A relay (see `OutboxRelay`) later claims pending rows with
 * `FOR UPDATE SKIP LOCKED` — so multiple API replicas lease disjoint rows —
 * and delivers them to their real destination (EventEmitter2 or BullMQ).
 * Leases expire, so work owned by a process that died is reclaimed rather
 * than stuck.
 */
export class OutboxService {
  private readonly maxAttempts: number;
  private readonly baseRetryDelayMs: number;
  private readonly maxRetryDelayMs: number;
  private readonly logger?: { warn(message: string): void };
  private drainer?: () => Promise<unknown>;
  /**
   * The managers of the transactions `transaction()` has open, each with
   * whether anything was staged on it yet. A manager a caller opened itself is
   * not a key and is never recorded.
   */
  private readonly staged = new WeakMap<EntityManager, boolean>();

  constructor(
    private readonly dataSource: DataSource,
    options: OutboxServiceOptions = {},
  ) {
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.baseRetryDelayMs = options.baseRetryDelayMs ?? DEFAULT_BASE_RETRY_DELAY_MS;
    this.maxRetryDelayMs = options.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS;
    this.logger = options.logger;
  }

  /**
   * Run `work` in one transaction and, **after it commits**, wake the relay
   * if anything was staged on its manager (`stageEvents` with at least one
   * event, or `stageJob`). A rollback never wakes, and neither does a commit
   * that staged nothing. This is the one place the "stage, commit, then wake"
   * bookkeeping lives: a repository that locks, asks and writes in its own
   * statements does them all on `manager` and stages on it, and says nothing
   * about waking.
   *
   * ```ts
   * return this.outbox.transaction(async (manager) => {
   *   await manager.query(`UPDATE …`, […]);
   *   await this.outbox.stageEvents(manager, aggregate.domainEvents);
   *   return outcome;
   * });
   * ```
   *
   * Clearing an aggregate's events stays with the caller: after this resolves,
   * and only on success.
   */
  async transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    let staged = false;
    const result = await this.dataSource.transaction(async (manager) => {
      this.staged.set(manager, false);
      try {
        return await work(manager);
      } finally {
        staged = this.staged.get(manager) === true;
        this.staged.delete(manager);
      }
    });
    // Only reached once the transaction committed: a throw from `work` or
    // from the commit itself rejects above, and nothing is woken for rows
    // that never landed.
    if (staged) this.wake();
    return result;
  }

  /**
   * Run a repository write and stage the aggregates' collected domain events
   * **inside one transaction**, so the state change and the events it owes
   * commit or roll back together. After commit the relay is woken to deliver
   * soon, without waiting for it; if delivery fails, the rows stay pending and
   * the relay's poll retries them. Writes with no events skip the explicit
   * transaction — a single statement is already atomic.
   *
   * This is the write path `TypeOrmRepositoryBase` is built on:
   *
   * ```ts
   * await this.outbox.writeWithEvents([entity], (manager) =>
   *   manager.getRepository(UserOrmEntity).save(record),
   * );
   * ```
   */
  async writeWithEvents<T>(
    entities: readonly EventfulAggregate[],
    write: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const events = entities.flatMap((e) => e.domainEvents);
    if (events.length === 0) return write(this.dataSource.manager);
    const result = await this.transaction(async (manager) => {
      const value = await write(manager);
      await this.stageEvents(manager, events);
      return value;
    });
    for (const entity of entities) entity.clearEvents();
    return result;
  }

  /** Stage events on the caller's transaction, so they commit or roll back with its write. */
  async stageEvents(manager: EntityManager, events: readonly DomainEvent[]): Promise<void> {
    if (events.length === 0) return;
    const rows = events.map((event) => {
      const eventName = event.constructor.name;
      return this.buildRow({
        channel: 'event',
        topic: null,
        eventName,
        aggregateId: event.aggregateId,
        payload: JSON.parse(JSON.stringify(event)) as Record<string, unknown>,
        reason:
          event.reason ??
          `${eventName} raised by aggregate ${event.aggregateId}; owed to its subscribed listeners`,
        correlationId: event.metadata.correlationId,
        availableAt: undefined,
      });
    });
    const repository = manager.getRepository(OutboxMessageSchema);
    // Cast around TypeORM's `QueryDeepPartialEntity` recursion, which cannot
    // represent the free-form `payload` jsonb (Record<string, unknown>).
    await repository.insert(rows as Parameters<typeof repository.insert>[0]);
    this.markStaged(manager);
  }

  /**
   * Write a BullMQ job to the outbox inside the caller's transaction. The
   * relay enqueues it after commit, so "state committed but job never made it
   * to Redis" cannot happen.
   */
  async stageJob(manager: EntityManager, params: StageJobParams): Promise<void> {
    const repository = manager.getRepository(OutboxMessageSchema);
    const row = this.buildRow({
      channel: 'queue',
      topic: params.queue,
      eventName: params.jobName,
      aggregateId: params.aggregateId ?? null,
      payload: params.payload,
      reason: params.reason,
      correlationId: params.correlationId ?? RequestContextService.getCorrelationId() ?? null,
      availableAt: params.availableAt,
    });
    // Same `QueryDeepPartialEntity` cast as `stageEvents`.
    await repository.insert(row as Parameters<typeof repository.insert>[0]);
    this.markStaged(manager);
  }

  /** Record a staged row on a `transaction()` manager; any other is left alone. */
  private markStaged(manager: EntityManager): void {
    if (this.staged.has(manager)) this.staged.set(manager, true);
  }

  /**
   * Lease a batch of due rows for `owner`. A single `UPDATE … FROM (SELECT …
   * FOR UPDATE SKIP LOCKED)` claims rows atomically: concurrent relays skip
   * each other's rows instead of blocking or double-delivering, which is what
   * makes the pattern safe under horizontal scaling. Rows whose previous
   * lease (`lockedUntil`) lapsed are claimed again — lease expiry *is* the
   * crash recovery. The attempt counter increments at claim time so a process
   * that dies mid-delivery still consumes an attempt.
   *
   * The inner `SELECT` walks `IDX_outbox_message_pending` (`createdAt`,
   * partial on `status = 'pending'`) in its `ORDER BY`, so it reads the oldest
   * pending rows and stops at `LIMIT` instead of sorting the backlog. None of
   * the columns this sets is indexed, so the lease update can be HOT.
   */
  async claim(owner: string, options: ClaimOptions = {}): Promise<OutboxMessageRecord[]> {
    const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    const leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS;
    // TypeORM returns `[rows, affectedCount]` for UPDATE on Postgres.
    const [rows]: [OutboxMessageRecord[], number] = await this.dataSource.query(
      `UPDATE "${OUTBOX_TABLE}" AS m
       SET "lockedBy" = $1,
           "lockedUntil" = now() + ($2::int * interval '1 millisecond'),
           "attempts" = m."attempts" + 1
       FROM (
         SELECT "id" FROM "${OUTBOX_TABLE}"
         WHERE "status" = 'pending'
           AND "availableAt" <= now()
           AND ("lockedUntil" IS NULL OR "lockedUntil" <= now())
         ORDER BY "createdAt" ASC
         LIMIT $3
         FOR UPDATE SKIP LOCKED
       ) AS due
       WHERE m."id" = due."id"
       RETURNING m.*`,
      [owner, leaseMs, batchSize],
    );
    return rows;
  }

  /**
   * Renew `owner`'s lease on `ids` to `leaseMs` from now, and return the ids it
   * still held. The relay calls it on a timer while it delivers a batch, so a
   * listener slower than the lease keeps its rows instead of another replica
   * claiming and running them again. A row whose lease `owner` already lost (it
   * lapsed and another relay claimed it) or that is no longer pending is left
   * alone and missing from the result.
   */
  async extendLease(owner: string, ids: readonly string[], leaseMs: number): Promise<string[]> {
    if (ids.length === 0) return [];
    const [rows]: [{ id: string }[], number] = await this.dataSource.query(
      `UPDATE "${OUTBOX_TABLE}"
       SET "lockedUntil" = now() + ($3::int * interval '1 millisecond')
       WHERE "id" = ANY($1) AND "lockedBy" = $2 AND "status" = 'pending'
       RETURNING "id"`,
      [ids, owner, leaseMs],
    );
    return rows.map((row) => row.id);
  }

  /**
   * Mark delivered rows, releasing their leases, and return the ids it marked.
   * With `owner`, only rows that owner still leases are marked: a row another
   * relay claimed after this one lost the lease is that relay's to finish, and
   * is missing from the result (the same shape as `extendLease`).
   */
  async markProcessed(ids: readonly string[], owner?: string): Promise<string[]> {
    if (ids.length === 0) return [];
    // TypeORM returns `[rows, affectedCount]` for UPDATE on Postgres.
    const [rows]: [{ id: string }[], number] = await this.dataSource.query(
      `UPDATE "${OUTBOX_TABLE}"
       SET "status" = 'processed', "processedAt" = now(), "lockedBy" = NULL, "lockedUntil" = NULL
       WHERE "id" = ANY($1) AND ($2::varchar IS NULL OR "lockedBy" = $2::varchar)
       RETURNING "id"`,
      [ids, owner ?? null],
    );
    return rows.map((row) => row.id);
  }

  /**
   * Delete up to `batch` delivered rows created before `cutoff`, and return how
   * many went. The retention job calls it in a loop until a batch comes back
   * short. The batch is picked by `ctid` (the BRIN index on `createdAt` serves
   * the range), so one call locks only its own rows. `pending` rows are owed
   * and `failed` rows are the inspection trail; neither is ever deleted here.
   */
  async deleteProcessedBefore(cutoff: Date, batch: number): Promise<number> {
    // TypeORM returns `[rows, affectedCount]` for DELETE on Postgres.
    const [, affected]: [unknown, number] = await this.dataSource.query(
      `DELETE FROM "${OUTBOX_TABLE}"
        WHERE ctid = ANY (ARRAY(
          SELECT ctid FROM "${OUTBOX_TABLE}"
           WHERE "createdAt" < $1 AND "status" = 'processed'
           LIMIT $2
        ))`,
      [cutoff, batch],
    );
    return affected ?? 0;
  }

  /**
   * How many rows are parked as `failed`: owed side effects that ran out of
   * attempts and wait for a person. For a gauge or a health detail; the
   * count scans the table, which retention keeps to a week of rows.
   */
  async countFailed(): Promise<number> {
    const rows: { count: number }[] = await this.dataSource.query(
      `SELECT count(*)::int AS "count" FROM "${OUTBOX_TABLE}" WHERE "status" = 'failed'`,
    );
    return rows[0]?.count ?? 0;
  }

  /**
   * Record a delivery failure. The row goes back to `pending` with an
   * exponential-backoff `availableAt` until `maxAttempts` is exhausted, then
   * parks as `failed` — kept, with its reason and last error, rather than
   * dropped.
   *
   * The update is fenced on the claim `message` came from (its `lockedBy` and
   * `attempts`): if that lease lapsed and another relay claimed the row since,
   * this is a no-op, so a stale failure never releases the other relay's lease
   * or rewinds its backoff.
   */
  async markFailed(message: OutboxMessageRecord, error: string): Promise<void> {
    const exhausted = message.attempts >= this.maxAttempts;
    const status: OutboxMessageStatus = exhausted ? 'failed' : 'pending';
    const delayMs = Math.min(
      this.baseRetryDelayMs * 2 ** Math.max(message.attempts - 1, 0),
      this.maxRetryDelayMs,
    );
    await this.dataSource.query(
      `UPDATE "${OUTBOX_TABLE}"
       SET "status" = $2, "lastError" = $3, "lockedBy" = NULL, "lockedUntil" = NULL,
           "availableAt" = now() + ($4::int * interval '1 millisecond')
       WHERE "id" = $1 AND "attempts" = $5
         AND ($6::varchar IS NULL OR "lockedBy" = $6::varchar)`,
      [message.id, status, error, delayMs, message.attempts, message.lockedBy ?? null],
    );
  }

  /**
   * Register the relay's drain function so `wake()` can trigger an immediate
   * drain after a commit instead of waiting for the next poll.
   */
  registerDrainer(drainer: (() => Promise<unknown>) | undefined): void {
    this.drainer = drainer;
  }

  /**
   * Ask the relay to drain soon, if one is registered. `transaction()` and
   * `writeWithEvents()` call it after their commit; call it yourself only
   * after a transaction you opened some other way. Never waits for delivery
   * and never throws: the rows are durable and the relay's next poll retries
   * them, so neither the delivery backlog nor a delivery hiccup reaches the
   * request whose state change already committed. A caller does not know
   * when its listeners run.
   */
  wake(): void {
    if (!this.drainer) return;
    let drain: Promise<unknown>;
    try {
      drain = this.drainer();
    } catch (error) {
      this.warnDrainFailed(error);
      return;
    }
    void drain.catch((error: unknown) => this.warnDrainFailed(error));
  }

  private warnDrainFailed(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.logger?.warn(`Outbox drain failed; rows stay pending for the next poll: ${message}`);
  }

  private buildRow(row: {
    channel: OutboxChannel;
    topic: string | null;
    eventName: string;
    aggregateId: string | null;
    payload: Record<string, unknown>;
    reason: string;
    correlationId: string | null;
    availableAt: Date | undefined;
  }) {
    return {
      channel: row.channel,
      topic: row.topic,
      eventName: row.eventName,
      aggregateId: row.aggregateId,
      payload: row.payload,
      reason: row.reason,
      correlationId: row.correlationId,
      status: 'pending' as const,
      ...(row.availableAt ? { availableAt: row.availableAt } : {}),
    };
  }
}
