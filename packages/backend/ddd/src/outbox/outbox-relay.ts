import { AsyncLocalStorage } from 'node:async_hooks';
import type { OutboxService } from './outbox.service';
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
  /** Lease duration passed to `OutboxService.claim`. */
  leaseMs?: number;
  logger?: { warn(message: string): void };
}

const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_BATCH_SIZE = 20;

/**
 * Drains the outbox: claims due rows (leased via `FOR UPDATE SKIP LOCKED`, so
 * concurrent replicas work disjoint sets), hands each to the publisher, and
 * marks it processed or failed.
 *
 * Runs on two triggers: a background poll (the safety net that picks up rows
 * whose staking process died or whose post-commit drain failed) and explicit
 * `drainOnce()` calls routed through `OutboxService.wake()` right after a
 * commit, which keeps delivery latency at in-process levels in the happy path.
 * Drains are serialized through a promise chain so a wake landing mid-poll
 * queues a follow-up pass instead of racing it.
 *
 * A delivery can itself stage rows and wake the relay: an event handler that
 * dispatches a command whose repository stages the next job. That wake must
 * not wait for the chain, because the chain is waiting for the handler — the
 * two would hold each other forever, and every later wake behind them. So a
 * wake from inside a delivery queues its pass and returns at once; the rows
 * are durable, and the pass (or this drain's next batch) delivers them.
 */
export class OutboxRelay {
  private timer?: ReturnType<typeof setInterval>;
  private tail: Promise<number> = Promise.resolve(0);
  /** Set while a publisher runs, so a wake from inside it is recognised. */
  private readonly delivering = new AsyncLocalStorage<true>();

  constructor(
    private readonly outbox: OutboxService,
    private readonly publisher: OutboxPublisher,
    private readonly options: OutboxRelayOptions,
  ) {}

  start(): void {
    if (this.timer) return;
    this.outbox.registerDrainer(() => this.drainOnce());
    this.timer = setInterval(
      () => void this.drainOnce(),
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
    await this.tail.catch(() => 0);
  }

  /**
   * Drain until no due rows remain. Returns the number of rows delivered.
   * Concurrent calls are chained, never interleaved. Called from inside a
   * delivery, the pass is queued and the call resolves at once with 0.
   */
  drainOnce(): Promise<number> {
    const run = this.tail.then(
      () => this.drainBatches(),
      () => this.drainBatches(),
    );
    this.tail = run.catch(() => 0);
    return this.delivering.getStore() ? Promise.resolve(0) : run;
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
      for (const message of batch) {
        try {
          await this.delivering.run(true, () => this.publisher(message));
          await this.outbox.markProcessed([message.id]);
          delivered++;
        } catch (error) {
          this.options.logger?.warn(
            `Outbox delivery of ${message.eventName} (${message.id}) failed: ${describe(error)}`,
          );
          try {
            await this.outbox.markFailed(message, describe(error));
          } catch {
            // Can't reach the database to record the failure; the lease
            // expires and the row is reclaimed on a later pass.
          }
        }
      }
      if (batch.length < batchSize) return delivered;
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
