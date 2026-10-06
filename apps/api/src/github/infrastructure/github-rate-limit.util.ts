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
 * One token's lane: at most `CONCURRENCY_PER_TOKEN` requests at a time, and
 * none at all until `pausedUntil` when GitHub has asked for a pause.
 */
class TokenLane {
  private running = 0;
  private readonly waiting: (() => void)[] = [];
  pausedUntil = 0;

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.running >= CONCURRENCY_PER_TOKEN) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.running += 1;
    try {
      const pause = this.pausedUntil - Date.now();
      if (pause > 0) await sleep(Math.min(pause, MAX_WAIT_MS));
      return await work();
    } finally {
      this.running -= 1;
      this.waiting.shift()?.();
    }
  }
}

/** The lanes of every token this process reads with, keyed by a digest so no token is held as a key. */
export class GithubRequestGate {
  private readonly lanes = new Map<string, TokenLane>();

  run<T>(token: string, work: () => Promise<T>): Promise<T> {
    return this.laneOf(token).run(work);
  }

  /** Holds every request on this token until `until` (epoch ms). */
  pause(token: string, until: number): void {
    const lane = this.laneOf(token);
    lane.pausedUntil = Math.max(lane.pausedUntil, until);
  }

  private laneOf(token: string): TokenLane {
    const key = createHash('sha256').update(token).digest('hex').slice(0, 16);
    let lane = this.lanes.get(key);
    if (!lane) {
      lane = new TokenLane();
      this.lanes.set(key, lane);
    }
    return lane;
  }
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
