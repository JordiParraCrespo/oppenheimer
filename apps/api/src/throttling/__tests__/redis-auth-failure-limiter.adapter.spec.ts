import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RedisAuthFailureLimiter } from '../infrastructure/redis-auth-failure-limiter.adapter';
import type { RedisThrottlerStorage } from '../infrastructure/redis-throttler.adapter';

function fakeRedis(
  replies: [Error | null, unknown][] = [
    [null, -2],
    [null, 0],
  ],
) {
  const multi = {
    pttl: vi.fn().mockReturnThis(),
    exists: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(replies),
  };
  return {
    multi: vi.fn(() => multi),
    multiChain: multi,
    set: vi.fn().mockResolvedValue('OK'),
  };
}

/** `throttling.*`'s defaults: 30 refusals a minute, then a minute's block. */
const config = {
  getOrThrow: (key: string) =>
    ({
      'throttling.authFailureLimit': 30,
      'throttling.authFailureWindowSeconds': 60,
      'throttling.authFailureBlockSeconds': 60,
    })[key],
} as unknown as ConfigService;

describe('RedisAuthFailureLimiter', () => {
  let storage: { increment: ReturnType<typeof vi.fn> };
  let redis: ReturnType<typeof fakeRedis>;
  let limiter: RedisAuthFailureLimiter;

  const build = () =>
    new RedisAuthFailureLimiter(
      storage as unknown as RedisThrottlerStorage,
      redis as unknown as Redis,
      config,
    );

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    storage = { increment: vi.fn().mockResolvedValue({}) };
    redis = fakeRedis();
    limiter = build();
  });

  it('counts a refusal on the rate limiter’s own counter, 30 a minute then a minute’s block', () => {
    limiter.recordFailure('6.6.6.6');

    expect(storage.increment).toHaveBeenCalledWith(
      'ip:6.6.6.6',
      60_000,
      30,
      60_000,
      'auth-failures',
    );
  });

  it('answers the block and the voucher in one round trip', async () => {
    redis = fakeRedis([
      [null, 42_500],
      [null, 0],
    ]);
    limiter = build();

    await expect(limiter.retryAfter('6.6.6.6', 'cred:abc')).resolves.toBe(43);
    expect(redis.multi).toHaveBeenCalledTimes(1);
    expect(redis.multiChain.pttl).toHaveBeenCalledWith('throttle:auth-failures:ip:6.6.6.6:blocked');
    expect(redis.multiChain.exists).toHaveBeenCalledWith('throttle:auth-ok:cred:abc');
  });

  it('lets a vouched credential through a blocked address', async () => {
    // One broken client behind a shared address must not lock out the callers
    // beside it whose credentials work.
    redis = fakeRedis([
      [null, 42_500],
      [null, 1],
    ]);
    limiter = build();

    await expect(limiter.retryAfter('6.6.6.6', 'cred:abc')).resolves.toBe(0);
  });

  it('answers 0 for an address that is not blocked', async () => {
    await expect(limiter.retryAfter('6.6.6.6', 'cred:abc')).resolves.toBe(0);
  });

  it('fails open when Redis cannot answer', async () => {
    redis.multiChain.exec.mockRejectedValue(new Error('Connection is closed'));

    await expect(limiter.retryAfter('6.6.6.6', 'cred:abc')).resolves.toBe(0);
  });

  it('writes a voucher once per refresh interval, not once per request', () => {
    limiter.recordSuccess('cred:abc');
    limiter.recordSuccess('cred:abc');
    limiter.recordSuccess('cred:other');

    expect(redis.set).toHaveBeenCalledTimes(2);
    expect(redis.set).toHaveBeenCalledWith('throttle:auth-ok:cred:abc', '1', 'EX', 600);
  });
});
