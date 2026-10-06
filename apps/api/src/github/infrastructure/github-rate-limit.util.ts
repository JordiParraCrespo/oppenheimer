import { createHash } from 'node:crypto';

/**
 * How the pull request reads stay under GitHub's limits
 * (https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api):
 * a few requests in flight per token at most, a shared pause when GitHub says
 * wait, and the primary budget read from every answer rather than discovered
 * by a refusal (#247).
 */

/** Requests in flight per token. GitHub asks for serial calls; a handful keeps a cold queue usable. */
export const CONCURRENCY_PER_TOKEN = 4;
/** Below this many requests left in the hour, the token pauses until GitHub's reset. */
export const LOW_REMAINING = 25;
/** How long one request will wait out a limit before giving the refusal back to the caller. */
export const MAX_WAIT_MS = 20_000;
/** A secondary limit with no `Retry-After`: GitHub says to wait at least a minute. */
const SECONDARY_DEFAULT_MS = 60_000;

/**
 * A request not sent because GitHub's pause on its token outlasts what one
 * request will wait: the caller hears "wait until `resumeAt`", and GitHub is
 * not asked again before then.
 */
export class GithubPausedError extends Error {
  constructor(readonly resumeAt: number) {
    super('GitHub asked this token to wait');
  }
}

/**
 * One token's lane: at most `CONCURRENCY_PER_TOKEN` requests at a time, and
 * none at all until `pausedUntil` when GitHub has asked for a pause.
 */
class TokenLane {
  private running = 0;
  private readonly waiting: (() => void)[] = [];
  pausedUntil = 0;

  get idle(): boolean {
    return this.running === 0 && this.waiting.length === 0 && this.pausedUntil <= Date.now();
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.running >= CONCURRENCY_PER_TOKEN) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.running += 1;
    try {
      // Read after the slot is ours: a pause can land while a request waits for one.
      const pause = this.pausedUntil - Date.now();
      if (pause > MAX_WAIT_MS) throw new GithubPausedError(this.pausedUntil);
      if (pause > 0) await sleep(pause);
      return await work();
    } finally {
      this.running -= 1;
      this.waiting.shift()?.();
    }
  }
}

/**
 * The lanes of every token this process reads with, keyed by a digest so no
 * token is held as a key. Installation tokens turn over hourly, so a lane is
 * dropped once it is idle and unpaused rather than kept for the process's life.
 */
export class GithubRequestGate {
  private readonly lanes = new Map<string, TokenLane>();

  async run<T>(token: string, work: () => Promise<T>): Promise<T> {
    const key = keyOf(token);
    const lane = this.laneOf(key);
    try {
      return await lane.run(work);
    } finally {
      if (lane.idle && this.lanes.get(key) === lane) this.lanes.delete(key);
    }
  }

  /** Holds every request on this token until `until` (epoch ms). */
  pause(token: string, until: number): void {
    const lane = this.laneOf(keyOf(token));
    lane.pausedUntil = Math.max(lane.pausedUntil, until);
  }

  /** How many tokens have a lane now: idle, unpaused ones are not kept. */
  get size(): number {
    return this.lanes.size;
  }

  private laneOf(key: string): TokenLane {
    let lane = this.lanes.get(key);
    if (!lane) {
      // A paused lane whose token was never used again is swept once its pause is over.
      for (const [other, candidate] of this.lanes) if (candidate.idle) this.lanes.delete(other);
      lane = new TokenLane();
      this.lanes.set(key, lane);
    }
    return lane;
  }
}

function keyOf(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 16);
}

/** What GitHub's headers and status say about the limits on this answer. */
export interface RateLimitReading {
  /** GitHub refused this request for a limit: wait, then try again. */
  limited: boolean;
  /** When the token may ask again (epoch ms), if GitHub said or the budget is nearly spent. */
  resumeAt: number | null;
}

/**
 * Reads one answer's limits. A 429, or a 403 whose budget is spent or whose
 * message names the secondary limit, is a "wait" rather than a refusal; any
 * answer whose remaining budget is low pauses the token until the reset.
 */
export function readRateLimit(
  status: number,
  headers: { get(name: string): string | null },
  message: string | null,
  now = Date.now(),
): RateLimitReading {
  const retryAfter = Number(headers.get('retry-after'));
  const remaining = headers.get('x-ratelimit-remaining');
  const reset = Number(headers.get('x-ratelimit-reset'));
  const resetAt = Number.isFinite(reset) && reset > 0 ? reset * 1000 : null;
  const spent = remaining !== null && Number(remaining) === 0;
  const secondary = /secondary rate limit|abuse/i.test(message ?? '');
  const limited = status === 429 || (status === 403 && (spent || secondary));

  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return { limited, resumeAt: now + retryAfter * 1000 };
  }
  if (limited && spent && resetAt) return { limited, resumeAt: resetAt };
  if (limited) return { limited, resumeAt: now + SECONDARY_DEFAULT_MS };
  if (remaining !== null && Number(remaining) < LOW_REMAINING && resetAt) {
    return { limited: false, resumeAt: resetAt };
  }
  return { limited: false, resumeAt: null };
}

/** A wait with up to a fifth of jitter, so callers released together do not return together. */
export function withJitter(ms: number, random = Math.random): number {
  return Math.round(ms * (1 + random() * 0.2));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
