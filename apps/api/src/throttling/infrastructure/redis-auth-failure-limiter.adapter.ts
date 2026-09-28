import { Inject, Injectable, Logger } from '@nestjs/common';
import { describeError } from '@oppenheimer/backend-core';
import type Redis from 'ioredis';
import type { AuthFailureLimiterPort } from '../../auth/application/auth-failure-limiter.port';
import { REDIS_CLIENT } from '../../redis/redis.di-tokens';
import { RedisThrottlerStorage } from './redis-throttler.adapter';

/** Refused credentials an address may present per window before it is refused outright. */
const FAILURE_LIMIT = 30;
const FAILURE_WINDOW_MS = 60_000;
const BLOCK_MS = 60_000;

/** The counter's name in `RedisThrottlerStorage` — its keys are `throttle:auth-failures:ip:<ip>`. */
const THROTTLER_NAME = 'auth-failures';

/**
 * How long a success vouches for its credential while its address is blocked,
 * and how often one replica refreshes that voucher. The refresh interval keeps
 * a busy credential to one write every few minutes instead of one per request.
 */
const VOUCHER_TTL_SECONDS = 10 * 60;
const VOUCHER_REFRESH_MS = 5 * 60_000;
const VOUCHER_MEMORY = 10_000;

/**
 * {@link AuthFailureLimiterPort} on the rate limiter's own Redis counters.
 *
 * A refusal increments `throttle:auth-failures:ip:<ip>` through the same atomic
 * script every rate limit uses; past {@link FAILURE_LIMIT} in a minute the
 * script sets its `:blocked` key for a minute. Asking is one round trip: the
 * block's remaining time and whether this credential holds a recent voucher,
 * in one `MULTI`.
 *
 * Fails open throughout, like the limiter itself.
 */
@Injectable()
export class RedisAuthFailureLimiter implements AuthFailureLimiterPort {
  private readonly logger = new Logger(RedisAuthFailureLimiter.name);

  /** When this replica last wrote each credential's voucher. */
  private readonly vouched = new Map<string, number>();

  constructor(
    private readonly storage: RedisThrottlerStorage,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  recordFailure(ip: string): void {
    void this.storage
      .increment(failureKey(ip), FAILURE_WINDOW_MS, FAILURE_LIMIT, BLOCK_MS, THROTTLER_NAME)
      .catch((error: unknown) =>
        this.logger.warn(`Auth failure not counted: ${describeError(error)}`),
      );
  }

  recordSuccess(credentialKey: string): void {
    const now = Date.now();
    const last = this.vouched.get(credentialKey);
    if (last !== undefined && now - last < VOUCHER_REFRESH_MS) return;

    if (this.vouched.size >= VOUCHER_MEMORY) this.vouched.clear();
    this.vouched.set(credentialKey, now);
    void this.redis
      .set(voucherKey(credentialKey), '1', 'EX', VOUCHER_TTL_SECONDS)
      .catch((error: unknown) => {
        this.vouched.delete(credentialKey);
        this.logger.warn(`Credential voucher not written: ${describeError(error)}`);
      });
  }

  async retryAfter(ip: string, credentialKey: string): Promise<number> {
    try {
      const replies = await this.redis
        .multi()
        .pttl(`throttle:${THROTTLER_NAME}:${failureKey(ip)}:blocked`)
        .exists(voucherKey(credentialKey))
        .exec();
      const blockMs = Number(replies?.[0]?.[1] ?? -2);
      const vouched = Number(replies?.[1]?.[1] ?? 0) === 1;
      return blockMs > 0 && !vouched ? Math.ceil(blockMs / 1000) : 0;
    } catch (error) {
      this.logger.warn(`Auth failure budget unavailable; allowing: ${describeError(error)}`);
      return 0;
    }
  }
}

function failureKey(ip: string): string {
  return `ip:${ip}`;
}

function voucherKey(credentialKey: string): string {
  return `throttle:auth-ok:${credentialKey}`;
}
