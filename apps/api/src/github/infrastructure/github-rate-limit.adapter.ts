import { createHash } from 'node:crypto';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import {
  ConcurrencyLimit,
  type RateLimitedResponse,
  readRateLimit,
  UpstreamPause,
  upstreamRateLimited,
} from '@oppenheimer/backend-core';
import { GithubErrors } from '../domain/github.errors';

/**
 * Requests to GitHub in flight from this process at once. GitHub's secondary
 * limit starts at 100 concurrent requests across the App, and a queue page
 * fans out five reads per open pull request; this keeps one process well under
 * it, with room for the other replicas.
 */
const MAX_IN_FLIGHT = 8;

/**
 * GitHub refuses a secondary-limit breach with a 403 that may carry no
 * rate-limit header at all; its sentence is the only tell.
 */
const SECONDARY_LIMIT = /secondary rate limit|rate limit exceeded|abuse detection/i;

/**
 * What a GitHub call is counted against, which is what a pause covers:
 *
 * - `app` — the App's own JWT (installation lookups, minting tokens).
 * - `installation:<id>` — an installation's token, minted by the REST adapter.
 * - `oauth` — the code and refresh-token exchange.
 * - `token:<hash>` — a token handed in by a caller: an installation token the
 *   resolver keeps for most of its hour, or a person's own. Hashed, so a
 *   credential never becomes a cache key.
 */
export type GithubBucket = 'app' | 'oauth' | `installation:${number}` | `token:${string}`;

export function tokenBucket(token: string): GithubBucket {
  return `token:${createHash('sha256').update(token).digest('hex').slice(0, 16)}`;
}

/**
 * The one place GitHub's rate limits are honoured, around every call both
 * adapters make (`.agents/rules/integrations.md`):
 *
 * - **Before a call**, a bucket GitHub paused answers `GITHUB_015` at once,
 *   without asking GitHub again. Calling through a limit only earns another
 *   refusal, and GitHub's docs say an integration that keeps doing it can be
 *   banned.
 * - **Around it**, at most {@link MAX_IN_FLIGHT} calls are in flight.
 * - **After it**, a refusal for rate becomes `GITHUB_015` (a 429 with
 *   `Retry-After`) rather than whatever the call site maps a 403 to — a
 *   suspended installation, a repository out of reach — and a success that
 *   spent the last call pauses the bucket until GitHub's reset.
 *
 * The pause is shared through Redis, so every replica stops together.
 */
@Injectable()
export class GithubRateLimit {
  private readonly logger = new Logger(GithubRateLimit.name);
  private readonly pauses: UpstreamPause;
  private readonly inFlight = new ConcurrencyLimit(MAX_IN_FLIGHT);

  constructor(@Optional() cache?: CacheService) {
    this.pauses = new UpstreamPause('github', cache);
  }

  /** Run one call to GitHub, unless `bucket` is paused. */
  async call<T>(bucket: GithubBucket, send: () => Promise<T>): Promise<T> {
    const until = await this.pauses.pausedUntil(bucket);
    if (until)
      throw upstreamRateLimited(GithubErrors.RATE_LIMITED, { system: 'GitHub', resetAt: until });
    return this.inFlight.run(send);
  }

  /**
   * Read a successful answer's budget: the call that spent the last request
   * pauses the bucket, so the next one does not have to be refused to learn it.
   */
  async observe(bucket: GithubBucket, response: RateLimitedResponse): Promise<void> {
    const signal = readRateLimit(response);
    if (signal.remaining === 0) await this.pauses.pause(bucket, signal.resetAt);
  }

  /**
   * Throw `GITHUB_015` when a refusal was for rate; return when it was not, so
   * the call site maps it as before. `upstreamMessage` is GitHub's own sentence
   * from the error body, the only tell of a secondary limit without headers.
   */
  async refuseIfLimited(
    bucket: GithubBucket,
    response: RateLimitedResponse,
    upstreamMessage: string | undefined,
  ): Promise<void> {
    const signal = readRateLimit(response);
    const secondary =
      response.status === 403 &&
      upstreamMessage !== undefined &&
      SECONDARY_LIMIT.test(upstreamMessage);
    if (!signal.limited && !secondary) return;

    const resetAt = await this.pauses.pause(bucket, signal.resetAt);
    this.logger.warn({
      message: 'GitHub rate limit reached; pausing calls',
      bucket: bucket.startsWith('token:') ? 'token' : bucket,
      status: response.status,
      resetAt: resetAt.toISOString(),
    });
    throw upstreamRateLimited(GithubErrors.RATE_LIMITED, {
      system: 'GitHub',
      resetAt,
      detail: upstreamMessage,
    });
  }
}
