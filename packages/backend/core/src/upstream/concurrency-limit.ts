/**
 * At most `limit` calls in flight; the rest wait their turn, first come first
 * served.
 *
 * A screen that fans out (`Promise.all` over every open pull request of every
 * watched repository) would otherwise open a hundred connections to a provider
 * at once, and concurrency is itself rate-limited: GitHub's secondary limit
 * counts concurrent requests before it counts anything else. Put one of these
 * in the adapter, around the network call, so no caller can forget it.
 */
export class ConcurrencyLimit {
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError(`A concurrency limit is a positive integer, not ${limit}`);
    }
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active < this.limit) {
      this.active += 1;
    } else {
      // The finishing call hands its slot straight over, so `active` never
      // dips and a newcomer cannot take the slot a waiter was promised.
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    try {
      return await task();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active -= 1;
    }
  }
}
