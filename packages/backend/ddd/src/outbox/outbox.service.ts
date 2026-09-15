import type { DataSource, EntityManager } from 'typeorm';
import type { DomainEvent } from '../domain-event.base';
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
  /** BullMQ job name. */
  jobName: string;
  payload: Record<string, unknown>;
  /** Why this job is owed — recorded on the row so it is self-explaining. */
  reason: string;
  aggregateId?: string;
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
const DEFAULT_LEASE_MS = 30_000;

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
   * Run a repository write and stage the aggregates' collected domain events
   * **inside one transaction**, so the state change and the events it owes
   * commit or roll back together. After commit the relay is woken to deliver
   * immediately; if that fails, the rows stay pending and the relay's poll
   * retries them. Writes with no events skip the explicit transaction — a
   * single statement is already atomic.
   *
   * This is the one write path every repository adapter shares:
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
    const result = await this.dataSource.transaction(async (manager) => {
      const value = await write(manager);
      await this.stageEvents(manager, events);
      return value;
    });
    for (const entity of entities) entity.clearEvents();
    await this.wake();
    return result;
  }

  /**
   * Write the aggregate's collected domain events to the outbox using the
   * caller's transactional `EntityManager`, making the events atomic with the
   * aggregate write: both commit or neither does.
   */
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
      correlationId: params.correlationId ?? null,
      availableAt: params.availableAt,
    });
    // Same `QueryDeepPartialEntity` cast as `stageEvents`.
    await repository.insert(row as Parameters<typeof repository.insert>[0]);
  }

  /**
   * Lease a batch of due rows for `owner`. A single `UPDATE … FROM (SELECT …
   * FOR UPDATE SKIP LOCKED)` claims rows atomically: concurrent relays skip
   * each other's rows instead of blocking or double-delivering, which is what
   * makes the pattern safe under horizontal scaling. Rows whose previous
   * lease (`lockedUntil`) lapsed are claimed again — lease expiry *is* the
   * crash recovery. The attempt counter increments at claim time so a process
   * that dies mid-delivery still consumes an attempt.
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

  /** Mark delivered rows, releasing their leases. */
  async markProcessed(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.dataSource.query(
      `UPDATE "${OUTBOX_TABLE}"
       SET "status" = 'processed', "processedAt" = now(), "lockedBy" = NULL, "lockedUntil" = NULL
       WHERE "id" = ANY($1)`,
      [ids],
    );
  }

  /**
   * Record a delivery failure. The row goes back to `pending` with an
   * exponential-backoff `availableAt` until `maxAttempts` is exhausted, then
   * parks as `failed` — kept, with its reason and last error, rather than
   * dropped.
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
       WHERE "id" = $1`,
      [message.id, status, error, delayMs],
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
   * Drain staged rows now, if a relay is registered. Call after the staging
   * transaction commits. Failures are swallowed: the rows are durable and the
   * relay's next poll retries them, so a delivery hiccup must not fail the
   * request whose state change already committed.
   */
  async wake(): Promise<void> {
    if (!this.drainer) return;
    try {
      await this.drainer();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger?.warn(`Outbox drain failed; rows stay pending for the next poll: ${message}`);
    }
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
