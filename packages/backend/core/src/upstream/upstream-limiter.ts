import { Logger } from '@nestjs/common';
import type { ErrorDefinition } from '../errors/app.error';
import {
  ConcurrencyLimit,
  type ConcurrencyLimitOptions,
  ConcurrencyLimitSaturatedError,
} from './concurrency-limit';
import { type RateLimitedResponse, readRateLimit } from './rate-limit-signal';
import {
  UpstreamPause,
  type UpstreamPauseOptions,
  type UpstreamPauseStore,
} from './upstream-pause';
import { upstreamRateLimited } from './upstream-rate-limited.error';

/** What `exchange` needs of a response: the status, the headers and, for a refusal, the body. */
export interface ExchangedResponse extends RateLimitedResponse {
  text(): Promise<string>;
}

/**
 * The adapter's reading of a refusal's body, for what no header says: whether
 * it was about rate, and which bucket it covers when that is not the first
 * (Google's project-wide quota against a person's own).
 */
export type RefusalReader = (errorBody: string) => { limited: boolean; bucket?: string };

export interface UpstreamLimiterOptions extends UpstreamPauseOptions, ConcurrencyLimitOptions {
  /** Calls to this system in flight from this process at once. */
  maxInFlight: number;
}

/**
 * The one way an adapter calls a system we do not run
 * (`.agents/rules/integrations.md`). {@link exchange} does every step, in
 * order, so no adapter can skip one:
 *
 * 1. waits for a slot under the in-flight cap, or refuses at once when too
 *    many are waiting;
 * 2. inside the slot, refuses without calling when any of the call's buckets
 *    is paused;
 * 3. sends;
 * 4. reads the answer (headers, and for a refusal the body through the
 *    adapter's {@link RefusalReader});
 * 5. on a refusal for rate, pauses the bucket and throws the system's
 *    rate-limit problem; on a success that spent the last call, pauses the
 *    bucket and returns;
 * 6. otherwise returns the response, with a refusal's body already read.
 *
 * Every refusal it throws is `upstreamRateLimited(error, …)`: a `429` with
 * `Retry-After`. Anything else — a network failure, a 404 — is the adapter's
 * to map, as before.
 */
export class UpstreamLimiter {
  private readonly logger = new Logger(UpstreamLimiter.name);
  private readonly pauses: UpstreamPause;
  private readonly inFlight: ConcurrencyLimit;

  constructor(
    private readonly system: string,
    private readonly error: ErrorDefinition,
    store: UpstreamPauseStore | undefined,
    private readonly options: UpstreamLimiterOptions,
  ) {
    this.pauses = new UpstreamPause(system, store, options);
    this.inFlight = new ConcurrencyLimit(options.maxInFlight, options);
  }

  /**
   * One call. `buckets` are what it counts against; the first is the one a
   * spent budget or an unattributed refusal pauses.
   */
  async exchange<R extends ExchangedResponse>(
    buckets: string | readonly string[],
    send: () => Promise<R>,
    readRefusal?: RefusalReader,
  ): Promise<{ response: R; errorBody: string | null }> {
    const list = typeof buckets === 'string' ? [buckets] : buckets;
    try {
      return await this.inFlight.run(() => this.once(list, send, readRefusal));
    } catch (error) {
      if (!(error instanceof ConcurrencyLimitSaturatedError)) throw error;
      this.logger.warn({
        message: `Too many ${this.system} calls waiting; refusing`,
        buckets: list,
      });
      throw upstreamRateLimited(this.error, {
        system: this.system,
        resetAt: new Date(Date.now() + this.options.maxWaitMs),
        detail: `Too many ${this.system} requests at once; try again shortly.`,
      });
    }
  }

  private async once<R extends ExchangedResponse>(
    buckets: readonly string[],
    send: () => Promise<R>,
    readRefusal: RefusalReader | undefined,
  ): Promise<{ response: R; errorBody: string | null }> {
    for (const bucket of buckets) {
      const until = await this.pauses.pausedUntil(bucket);
      if (until) throw upstreamRateLimited(this.error, { system: this.system, resetAt: until });
    }

    const response = await send();
    // A refusal's body names the problem and carries no credential; a success
    // body may (an access token), and is never read here.
    const errorBody = response.status >= 400 ? await response.text().catch(() => '') : null;
    const read = errorBody === null ? undefined : readRefusal?.(errorBody);
    const signal = readRateLimit(response, { bodyLimited: read?.limited });

    if (signal.limited) {
      const bucket = read?.bucket ?? buckets[0];
      const resetAt = await this.pauses.pause(bucket, signal.resetAt);
      this.logger.warn({
        message: `${this.system} rate limit reached; pausing calls`,
        bucket,
        status: response.status,
        resetAt: resetAt.toISOString(),
      });
      throw upstreamRateLimited(this.error, {
        system: this.system,
        resetAt,
        detail: messageOf(errorBody),
      });
    }
    if (signal.remaining === 0) await this.pauses.pause(buckets[0], signal.resetAt);
    return { response, errorBody };
  }
}

/** A provider's own sentence from a JSON error body, when it has one. */
function messageOf(body: string | null): string | undefined {
  if (!body) return undefined;
  try {
    const parsed = JSON.parse(body) as { message?: unknown; error?: { message?: unknown } };
    const message = parsed.message ?? parsed.error?.message;
    return typeof message === 'string' ? message : undefined;
  } catch {
    return undefined;
  }
}
