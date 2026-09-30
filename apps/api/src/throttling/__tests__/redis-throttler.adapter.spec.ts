import type Redis from 'ioredis';
import { describe, expect, it, vi } from 'vitest';
import { RedisThrottlerStorage } from '../infrastructure/redis-throttler.adapter';

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
  it('registers the increment script once, as a command', () => {
    const redis = fakeRedis(async () => [1, 60_000, 0, 0]);

    new RedisThrottlerStorage(redis as unknown as Redis);
    // A second storage on the same shared client reuses the command.
    new RedisThrottlerStorage(redis as unknown as Redis);

    expect(redis.defineCommand).toHaveBeenCalledTimes(1);
    expect(redis.defineCommand).toHaveBeenCalledWith(
      'throttleIncrement',
      expect.objectContaining({ numberOfKeys: 1, lua: expect.stringContaining("'INCR'") }),
    );
  });

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
