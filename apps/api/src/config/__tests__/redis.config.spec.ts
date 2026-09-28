import { beforeEach, describe, expect, it } from 'vitest';
import {
  redisCommandClientOptions,
  redisConfigFromEnv,
  redisConnectionOptions,
} from '../redis.config';

/**
 * The `redis` section and the two option sets every Redis client in the API is
 * built from. There is one place the address and password are read, so a
 * `requirepass` Redis cannot accept the queue and refuse the cache again.
 */

const REDIS_VARS = ['REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD'];

function withEnv(values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
  return redisConfigFromEnv();
}

describe('redis config', () => {
  beforeEach(() => {
    for (const key of REDIS_VARS) delete process.env[key];
  });

  it('defaults to a local, unauthenticated Redis', () => {
    expect(redisConnectionOptions(withEnv({}))).toEqual({
      host: 'localhost',
      port: 6379,
      password: undefined,
    });
  });

  it('passes the configured password', () => {
    // `REDIS_PASSWORD` once reached BullMQ only; a `requirepass` Redis then
    // accepted the queue and refused every cache read.
    const options = redisConnectionOptions(
      withEnv({ REDIS_HOST: 'redis.internal', REDIS_PORT: '6380', REDIS_PASSWORD: 's3cret' }),
    );

    expect(options).toMatchObject({ host: 'redis.internal', port: 6380, password: 's3cret' });
  });

  it('connects without a password when it is blank', () => {
    expect(redisConnectionOptions(withEnv({ REDIS_PASSWORD: '' })).password).toBeUndefined();
  });

  it('gives BullMQ the address and nothing about retries', () => {
    // BullMQ workers require `maxRetriesPerRequest: null`; a fail-fast setting
    // leaking into its connection would stop them.
    const options = redisConnectionOptions(withEnv({}));

    expect(options).not.toHaveProperty('maxRetriesPerRequest');
    expect(options).not.toHaveProperty('enableOfflineQueue');
  });

  it('makes the command client fail fast instead of queueing during an outage', () => {
    const options = redisCommandClientOptions(withEnv({ REDIS_PASSWORD: 's3cret' }));

    expect(options).toMatchObject({
      host: 'localhost',
      port: 6379,
      password: 's3cret',
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    expect(options.commandTimeout).toBeGreaterThan(0);
    expect(options.connectTimeout).toBeGreaterThan(0);
  });
});
