/** Thrown by {@link ConcurrencyLimit.run} when a call could not get a slot in time. */
export class ConcurrencyLimitSaturatedError extends Error {
  override readonly name = 'ConcurrencyLimitSaturatedError';
}

export interface ConcurrencyLimitOptions {
  /** Calls allowed to wait for a slot; one more is refused at once. */
  maxQueued: number;
  /** How long a call may wait for a slot before it is refused. */
  maxWaitMs: number;
}

interface Waiter {
  start: () => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * At most `limit` calls in flight; a bounded number wait their turn, first come
 * first served, for a bounded time.
 *
 * A screen that fans out (`Promise.all` over every open pull request of every
 * watched repository) would otherwise open a hundred connections to a provider
 * at once, and concurrency is itself rate-limited: GitHub's secondary limit
 * counts concurrent requests first. Waiting is bounded because a request must
 * not hang on a provider's budget: past `maxQueued` or `maxWaitMs` the call is
 * refused with {@link ConcurrencyLimitSaturatedError}, which the limiter
 * answers as the provider's rate-limit problem.
 */
export class ConcurrencyLimit {
  private active = 0;
  private readonly waiting: Waiter[] = [];

  constructor(
    private readonly limit: number,
    private readonly options: ConcurrencyLimitOptions,
  ) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError(`A concurrency limit is a positive integer, not ${limit}`);
    }
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active < this.limit) {
      this.active += 1;
    } else {
      await this.wait();
    }
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  /**
   * Wait for a finishing call to hand its slot over. The slot moves straight to
   * the waiter, so `active` never dips and a newcomer cannot take it.
   */
  private wait(): Promise<void> {
    if (this.waiting.length >= this.options.maxQueued) {
      return Promise.reject(
        new ConcurrencyLimitSaturatedError(`${this.waiting.length} calls already waiting`),
      );
    }
    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = {
        start: () => {
          clearTimeout(waiter.timer);
          resolve();
        },
        timer: setTimeout(() => {
          const index = this.waiting.indexOf(waiter);
          if (index >= 0) this.waiting.splice(index, 1);
          reject(new ConcurrencyLimitSaturatedError(`No slot within ${this.options.maxWaitMs}ms`));
        }, this.options.maxWaitMs),
      };
      this.waiting.push(waiter);
    });
  }

  private release(): void {
    const next = this.waiting.shift();
    if (next) next.start();
    else this.active -= 1;
  }
}
