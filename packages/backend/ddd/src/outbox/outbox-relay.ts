import { DEFAULT_LEASE_MS, type OutboxService } from './outbox.service';
import type { OutboxMessageRecord } from './outbox-message';

/**
 * Delivers one claimed outbox row to its real destination. The consuming app
 * supplies this: emit `event` rows on the in-process bus, add `queue` rows to
 * the named BullMQ queue. A rejection marks the row failed (and retried later);
 * it never un-commits the state change that staged it.
 */
export type OutboxPublisher = (message: OutboxMessageRecord) => Promise<void>;

export interface OutboxRelayOptions {
  /** Identifies this relay instance on the leases it takes (host:pid). */
  owner: string;
  /** Poll interval for the background loop. */
  pollIntervalMs?: number;
  batchSize?: number;
  /** Lease duration passed to `OutboxService.claim` and renewed while a batch is delivered. */
  leaseMs?: number;
  /**
   * How often the lease on the batch being delivered is renewed. Defaults to a
   * third of `leaseMs`, so two renewals can fail before another relay may
   * claim the rows.
   */
  heartbeatMs?: number;
  logger?: { warn(message: string): void };
}

const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_BATCH_SIZE = 20;

/**
 * Drains the outbox: claims due rows (leased via `FOR UPDATE SKIP LOCKED`, so
 * concurrent replicas work disjoint sets), hands the batch to the publisher
 * at once (one call per row, all in flight together), and
 * marks the batch processed, or a row failed.
 *
 * Runs on two triggers: a background poll (the safety net that picks up rows
 * whose staging process died or whose post-commit drain failed) and
 * `OutboxService.wake()` right after a commit, which keeps delivery latency at
 * in-process levels in the happy path. Both go through `requestDrain()`. A
 * wake never waits for that drain, so the delivery backlog (and every
 * listener's body) stays off the request path.
 *
 * A delivery can itself stage rows and wake the relay: an event handler that
 * dispatches a command whose repository stages the next job. That wake only
 * asks for the next pass, which delivers what it staged.
 *
 * While a batch is delivered, a heartbeat renews its lease (`startHeartbeat`),
 * so a listener slower than `leaseMs` keeps its rows. The lease still lapses
 * when the process dies or stalls past the renewals, which is the crash
 * recovery. The marks that end a delivery are fenced on `owner`: a relay that
 * lost its lease neither marks the other relay's claim processed nor releases it.
 *
 * Delivery is at least once. The rows of a batch are marked processed in one
 * statement after the batch is published, so a process that dies in between
 * redelivers up to `batchSize` rows once their lease lapses; `queue` rows
 * dedupe on `jobId = row id`. One more duplicate is accepted, not fixed: an
 * `event` row is one delivery to every listener of that event, so when one
 * listener fails, the retry runs all of them again. Fanning a row out per
 * listener at staging time is the fix, and a larger change. Listeners must
 * therefore be idempotent.
 */
export class OutboxRelay {
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<number>;
  /** Set when a drain was requested while one was running: run one more pass. */
  private again = false;
  /** How many publisher promises are pending; above zero only inside a delivery. */
  private delivering = 0;

  constructor(
    private readonly outbox: OutboxService,
    private readonly publisher: OutboxPublisher,
    private readonly options: OutboxRelayOptions,
  ) {}

  start(): void {
    if (this.timer) return;
    this.outbox.registerDrainer(() => this.requestDrain());
    this.timer = setInterval(
      () => void this.requestDrain(),
      this.options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
    );
    // Never keep the process alive just to poll an empty table.
    this.timer.unref?.();
  }

  /** Stop polling and wait for any in-flight drain to settle. */
  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.outbox.registerDrainer(undefined);
    await this.running?.catch(() => 0);
  }

  /**
   * Request a drain. At most one runs; requests that land while it runs
   * collapse into one more pass after it. The promise resolves, with the
   * number of rows delivered, when the drain (that extra pass included) ends.
   */
  requestDrain(): Promise<number> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    const run = (async () => {
      let delivered = 0;
      try {
        do {
          this.again = false;
          delivered += await this.drainBatches();
        } while (this.again);
      } finally {
        // Cleared in the same tick as the last `again` check, so a request
        // landing after it starts a new drain instead of being dropped.
        this.running = undefined;
      }
      return delivered;
    })();
    this.running = run;
    return run;
  }

  /**
   * Drain until no due rows remain, and wait for it. Returns the number of rows
   * delivered. Called from inside a delivery, the pass is requested and the
   * call resolves at once with 0, since waiting would mean the drain waiting on
   * itself. The count is relay-wide, not per caller: an unrelated `drainOnce()`
   * made while a publisher is pending also resolves at once with 0.
   */
  drainOnce(): Promise<number> {
    const run = this.requestDrain();
    return this.delivering > 0 ? Promise.resolve(0) : run;
  }

  private async drainBatches(): Promise<number> {
    const batchSize = this.options.batchSize ?? DEFAULT_BATCH_SIZE;
    let delivered = 0;
    for (;;) {
      let batch: OutboxMessageRecord[];
      try {
        batch = await this.outbox.claim(this.options.owner, {
          batchSize,
          leaseMs: this.options.leaseMs,
        });
      } catch (error) {
        this.options.logger?.warn(`Outbox claim failed: ${describe(error)}`);
        return delivered;
      }
      if (batch.length === 0) return delivered;
      const leased = new Set(batch.map((message) => message.id));
      const stopHeartbeat = this.startHeartbeat(leased);
      let published: string[];
      try {
        published = await this.deliver(batch, leased);
      } finally {
        stopHeartbeat();
      }
      let marked: string[];
      try {
        marked = await this.outbox.markProcessed(published, this.options.owner);
      } catch (error) {
        // The rows stay leased until it lapses, then are delivered again.
        this.options.logger?.warn(
          `Outbox could not mark ${published.length} delivered rows processed: ${describe(error)}`,
        );
        return delivered;
      }
      // A row whose lease was lost mid-delivery belongs to the relay that
      // claimed it since; it finishes (and counts) it.
      delivered += marked.length;
      if (batch.length < batchSize) return delivered;
    }
  }

  /**
   * Publish every row of a claimed batch at once and resolve, once all of
   * them have settled, with the ids that went out, read from the settled
   * results rather than collected by the callbacks. A row that fails is
   * marked failed as soon as it does, so its backoff starts then: it leaves
   * `leased` first (the heartbeat's set of rows it renews, which only this
   * relay's own bookkeeping touches), since `markFailed` releases its lease.
   *
   * Concurrent, not one row after another: in sequence the relay's
   * throughput is the reciprocal of one publish's latency, whatever the pool
   * or the workers allow. The batch is bounded by `batchSize`, so this is
   * bounded concurrency. Nothing is lost by it: rows of one batch never had
   * an order a listener could rely on, since a failed row is retried after
   * the rows behind it and replicas claim neighbouring rows in parallel.
   */
  private async deliver(
    batch: readonly OutboxMessageRecord[],
    leased: Set<string>,
  ): Promise<string[]> {
    const settled = await Promise.allSettled(
      batch.map(async (message) => {
        try {
          await this.publish(message);
        } catch (error) {
          await this.fail(message, error, leased);
          throw error;
        }
        return message.id;
      }),
    );
    return settled.flatMap((outcome) => (outcome.status === 'fulfilled' ? [outcome.value] : []));
  }

  private async publish(message: OutboxMessageRecord): Promise<void> {
    this.delivering += 1;
    try {
      await this.publisher(message);
    } finally {
      this.delivering -= 1;
    }
  }

  private async fail(
    message: OutboxMessageRecord,
    error: unknown,
    leased: Set<string>,
  ): Promise<void> {
    const reason = describe(error);
    this.options.logger?.warn(
      `Outbox delivery of ${message.eventName} (${message.id}) failed: ${reason}`,
    );
    leased.delete(message.id);
    try {
      await this.outbox.markFailed(message, reason);
    } catch {
      // Can't reach the database to record the failure; the lease
      // expires and the row is reclaimed on a later pass.
    }
  }

  /**
   * Renew the lease on the `leased` rows every `heartbeatMs` until the
   * returned function is called. Rows already published stay in the set: they
   * are leased until `markProcessed`. A row the renewal no longer finds under
   * this owner was lost (the process stalled past `leaseMs` and another relay
   * claimed it); it is logged and dropped from the set, and the fenced marks
   * leave it to that relay. A failed renewal is logged, not thrown: the
   * delivery carries on and the next tick tries again.
   */
  private startHeartbeat(leased: Set<string>): () => void {
    const leaseMs = this.options.leaseMs ?? DEFAULT_LEASE_MS;
    const heartbeatMs = this.options.heartbeatMs ?? Math.max(Math.floor(leaseMs / 3), 1);
    let renewing = false;
    const timer = setInterval(() => {
      // Never stack renewals on a slow database; the next tick tries again.
      if (renewing || leased.size === 0) return;
      renewing = true;
      const ids = [...leased];
      void this.outbox
        .extendLease(this.options.owner, ids, leaseMs)
        .then((kept) => {
          const lost = ids.filter((id) => leased.has(id) && !kept.includes(id));
          for (const id of lost) leased.delete(id);
          if (lost.length > 0) {
            this.options.logger?.warn(
              `Outbox lease lost on ${lost.length} row(s) still being delivered: ${lost.join(', ')}`,
            );
          }
        })
        .catch((error: unknown) => {
          this.options.logger?.warn(`Outbox lease renewal failed: ${describe(error)}`);
        })
        .finally(() => {
          renewing = false;
        });
    }, heartbeatMs);
    // A renewal never keeps the process alive on its own.
    timer.unref?.();
    return () => clearInterval(timer);
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
