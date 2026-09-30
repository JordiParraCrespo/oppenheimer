import type Redis from 'ioredis';
import { describe, expect, it, vi } from 'vitest';
import { RedisThrottlerStorage } from '../infrastructure/redis-throttler.adapter';

/**
 * The rate-limit counter store on the shared Redis client: how its reply maps
 * onto Nest's record, and that a Redis outage lets the request through. That
 * the script is registered once and run by hash (`EVALSHA`) is proven against
 * a real Redis in `redis/__tests__/redis.integration.spec.ts`.
 */
function fakeRedis(reply: () => Promise<unknown>) {
  const redis = {
    defineCommand: vi.fn((name: string) => {
      (redis as Record<string, unknown>)[name] = vi.fn(reply);
    }),
  };
  return redis;
}

type Fake = ReturnType<typeof fakeRedis> & { throttleIncrement?: ReturnType<typeof vi.fn> };

describe('RedisThrottlerStorage', () => {
  it('runs the command on the throttle key and maps its reply', async () => {
    const redis: Fake = fakeRedis(async () => [101, 30_500, 1, 59_001]);
    const storage = new RedisThrottlerStorage(redis as unknown as Redis);

    const record = await storage.increment('user:ana', 60_000, 100, 60_000, 'default');

    expect(redis.throttleIncrement).toHaveBeenCalledWith(
      'throttle:default:user:ana',
      60_000,
      60_000,
      100,
    );
    expect(record).toEqual({
      totalHits: 101,
      timeToExpire: 31,
      isBlocked: true,
      timeToBlockExpire: 60,
    });
  });

  it('fails open when Redis is unavailable', async () => {
    const redis = fakeRedis(async () => {
      throw new Error("Stream isn't writeable and enableOfflineQueue options is false");
    });
    const storage = new RedisThrottlerStorage(redis as unknown as Redis);

    await expect(storage.increment('ip:1.2.3.4', 60_000, 100, 0, 'default')).resolves.toEqual({
      totalHits: 0,
      timeToExpire: 0,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });
});
