import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const RedisCtor = vi.fn();
const redisSet = vi.fn();

vi.mock('ioredis', () => ({
  default: class {
    set = redisSet;

    constructor(options: unknown) {
      RedisCtor(options);
    }
  },
}));

const { RedisCacheService } = await import('./redis-cache.service');

function config(values: Record<string, unknown>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

function service(): InstanceType<typeof RedisCacheService> {
  return new RedisCacheService(config({ 'redis.host': 'localhost', 'redis.port': 6379 }));
}

describe('RedisCacheService', () => {
  beforeEach(() => {
    RedisCtor.mockClear();
    redisSet.mockReset();
  });

  it('passes the configured password to the client', () => {
    // `REDIS_PASSWORD` used to reach BullMQ only; a `requirepass` Redis then
    // accepted the queue and refused every cache read.
    new RedisCacheService(
      config({ 'redis.host': 'redis.internal', 'redis.port': 6380, 'redis.password': 's3cret' }),
    );

    expect(RedisCtor).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'redis.internal', port: 6380, password: 's3cret' }),
    );
  });

  it('connects without a password when none is configured', () => {
    new RedisCacheService(config({ 'redis.host': 'localhost', 'redis.port': 6379 }));

    expect(RedisCtor.mock.calls[0][0]).toMatchObject({ password: undefined });
  });

  describe('setIfAbsent', () => {
    it('claims a free key in one atomic command', async () => {
      redisSet.mockResolvedValue('OK');

      await expect(service().setIfAbsent('jti:abc', 1, 300)).resolves.toBe(true);
      // NX is what decides the race, and EX is what stops the marker leaking:
      // both belong in the same command as the write.
      expect(redisSet).toHaveBeenCalledWith('jti:abc', '1', 'EX', 300, 'NX');
    });

    it('reports a key someone else already claimed', async () => {
      // Redis answers `null` when NX refuses, which is the whole point: the
      // loser of the race learns it lost rather than overwriting the winner.
      redisSet.mockResolvedValue(null);

      await expect(service().setIfAbsent('jti:abc', 1, 300)).resolves.toBe(false);
    });
  });
});
