import { beforeEach, describe, expect, it } from 'vitest';
import {
  redisCommandClientOptions,
  redisConfigFromEnv,
  redisConnectionOptions,
} from '../redis.config';

const REDIS_VARS = ['REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD'];

function withEnv(values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
  return redisConfigFromEnv();
}

describe('redis config', () => {
  beforeEach(() => {
    for (const key of REDIS_VARS) delete process.env[key];
  });

  it('defaults to a local, unauthenticated Redis, and gives BullMQ nothing about retries', () => {
    // Exact: BullMQ workers require `maxRetriesPerRequest: null`; a fail-fast
    // setting leaking into its connection would stop them.
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
