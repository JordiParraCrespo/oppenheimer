import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const RedisCtor = vi.fn();

vi.mock('ioredis', () => ({
  default: class {
    constructor(options: unknown) {
      RedisCtor(options);
    }
  },
}));

const { RedisCacheService } = await import('./redis-cache.service');

function config(values: Record<string, unknown>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('RedisCacheService', () => {
  beforeEach(() => {
    RedisCtor.mockClear();
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
});
