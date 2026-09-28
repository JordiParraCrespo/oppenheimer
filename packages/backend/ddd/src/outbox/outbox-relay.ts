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
 * marks the batch processed, or a row failed.
 *
 * Runs on two triggers: a background poll (the safety net that picks up rows
 * whose staging process died or whose post-commit drain failed) and
 * `OutboxService.wake()` right after a commit, which keeps delivery latency at
 * in-process levels in the happy path. Both go through `requestDrain()`: at
 * most one drain runs at a time, and every request that lands while it runs
 * collapses into one more pass after it. A wake never waits for that drain, so
 * the delivery backlog (and every listener's body) stays off the request path.
 *
 * A delivery can itself stage rows and wake the relay: an event handler that
 * dispatches a command whose repository stages the next job. That wake only
 * asks for the next pass, which delivers what it staged. The awaited
 * `drainOnce()` called from inside a delivery resolves at once with 0, since
 * waiting would mean the drain waiting on itself.
 *
 * Delivery is at least once. The rows of a batch are marked processed in one
 * statement after the batch is published, so a process that dies in between
 * redelivers up to `batchSize` rows once their lease lapses; `queue` rows
 * dedupe on `jobId = row id`. Two more duplicates are accepted, not fixed:
 * - the lease is not extended while a publisher runs, so a delivery slower than
 *   `leaseMs` (30 s by default) can be claimed and run again by another
 *   replica's poll. A lease heartbeat is the fix if that shows up;
 * - an `event` row is one delivery to every listener of that event, so when
 *   one listener fails, the retry runs all of them again. Fanning a row out
 *   per listener at staging time is the fix, and a larger change.
 * Listeners must therefore be idempotent.
 */
export class OutboxRelay {
  private timer?: ReturnType<typeof setInterval>;
  /** The drain in progress, if any. */
  private running?: Promise<number>;
  /** Set when a drain was requested while one was running: run one more pass. */
  private again = false;
  /** Set while a publisher runs, so a drain requested from inside it is recognised. */
  private readonly delivering = new AsyncLocalStorage<true>();

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
   * call resolves at once with 0.
   */
  drainOnce(): Promise<number> {
    const run = this.requestDrain();
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
      const published: string[] = [];
      for (const message of batch) {
        try {
          await this.delivering.run(true, () => this.publisher(message));
          published.push(message.id);
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
      try {
        await this.outbox.markProcessed(published);
      } catch (error) {
        // The rows stay leased until it lapses, then are delivered again.
        this.options.logger?.warn(
          `Outbox could not mark ${published.length} delivered rows processed: ${describe(error)}`,
        );
        return delivered;
      }
      delivered += published.length;
      if (batch.length < batchSize) return delivered;
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
