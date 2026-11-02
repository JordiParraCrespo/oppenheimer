import { Logger } from '@nestjs/common';
import type { UpstreamPauseStore } from './upstream-pause';

/**
 * What a provider lets one bucket spend in a window, as the provider counts
 * it: Gmail's quota units a person may spend a minute, GitHub's requests an
 * installation may make an hour. Set it below the provider's own number, so
 * the limit we keep is the one that stops a burst, not the provider's.
 */
export interface UpstreamBudgetOptions {
  /** What one bucket may spend in a window, in the provider's own units. */
  units: number;
  windowMs: number;
}

/** The most windows held in this process before the ones that have passed are dropped. */
const LOCAL_MAX = 1_000;

/**
 * A bucket's spending in fixed windows, shared through the store when it can
 * count (`incrementBy`), so every replica spends from one budget. The limiter
 * spends a call's cost before it sends the call: a provider's limit we know is
 * one we can keep without being told, rather than learn from its refusal. A
 * store that cannot count, or is down, never fails a call: the budget is then
 * this process's alone, and the failure is logged.
 */
export class UpstreamBudget {
  private readonly logger = new Logger(UpstreamBudget.name);
  private readonly local = new Map<string, { window: number; spent: number }>();

  constructor(
    private readonly system: string,
    private readonly store: UpstreamPauseStore | undefined,
    private readonly options: UpstreamBudgetOptions,
  ) {
    if (!(options.units > 0) || !(options.windowMs > 0)) {
      throw new RangeError(`A ${system} budget needs positive units and a window`);
    }
  }

  get units(): number {
    return this.options.units;
  }

  get windowMs(): number {
    return this.options.windowMs;
  }

  /**
   * Spends `cost` from `bucket`'s current window. Null when it fits; when it
   * does not, the moment the window ends, before which the bucket may not be
   * called.
   */
  async spend(bucket: string, cost: number, now: number = Date.now()): Promise<Date | null> {
    const window = Math.floor(now / this.options.windowMs);
    const held = this.local.get(bucket);
    let spent = (held?.window === window ? held.spent : 0) + cost;
    this.remember(bucket, window, spent);
    if (this.store?.incrementBy) {
      try {
        const ttlSeconds = Math.ceil(this.options.windowMs / 1000) + 1;
        spent = Math.max(
          spent,
          await this.store.incrementBy(this.key(bucket, window), cost, ttlSeconds),
        );
      } catch (error) {
        this.logger.warn({
          message: `Could not count the shared ${this.system} budget; counting in this process only`,
          bucket,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return spent > this.options.units ? new Date((window + 1) * this.options.windowMs) : null;
  }

  private remember(bucket: string, window: number, spent: number): void {
    if (this.local.size >= LOCAL_MAX && !this.local.has(bucket)) {
      for (const [key, held] of this.local) if (held.window < window) this.local.delete(key);
    }
    this.local.set(bucket, { window, spent });
  }

  private key(bucket: string, window: number): string {
    return `upstream:budget:${this.system}:${bucket}:${window}`;
  }
}
