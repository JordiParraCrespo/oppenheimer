import { registerAs } from '@nestjs/config';
import type { RedisOptions } from 'ioredis';
import { z } from 'zod';
import { parseEnv } from './env';

const schema = z.object({
  host: z.string().default('localhost'),
  port: z.coerce.number().default(6379),
  // **Optional** — set when Redis requires auth (`requirepass`). Absent means an
  // unauthenticated connection, which is only safe on a private network.
  password: z.string().optional(),
});

export type RedisConfig = z.infer<typeof schema>;

const ENV_KEYS = {
  host: 'REDIS_HOST',
  port: 'REDIS_PORT',
  password: 'REDIS_PASSWORD',
};

/**
 * The `redis` section parsed straight from the environment, for the consumers
 * that cannot inject `ConfigService`: Better Auth's standalone email queue is
 * built at module scope. `redisConfig` below is the same call, so the two
 * cannot disagree about where Redis is.
 */
export function redisConfigFromEnv(): RedisConfig {
  return parseEnv('redis', schema, ENV_KEYS);
}

export const redisConfig = registerAs('redis', () => redisConfigFromEnv());

/**
 * Where Redis is and how to authenticate: the one place a connection's address
 * is spelled out, so TLS, `db` or `username` are one edit, not five.
 *
 * BullMQ gets exactly this and nothing more. It manages its own retry policy
 * (its workers need `maxRetriesPerRequest: null` and a blocking connection),
 * which is the opposite of the command client's below.
 */
export function redisConnectionOptions(config: RedisConfig): RedisOptions {
  return {
    host: config.host,
    port: config.port,
    // `undefined` when unset (a blank `REDIS_PASSWORD=` is unset, see `parseEnv`).
    password: config.password,
  };
}

/**
 * The API's own command client (cache, rate-limit counters, readiness probe):
 * fail fast, so a Redis outage degrades a request instead of hanging it.
 *
 * With ioredis's defaults a command issued while Redis is down is queued and
 * retried up to twenty times, so a cache read waits seconds before the caller's
 * `catch` ever runs. Here it is refused at once while the socket is down, and
 * given a second when Redis is up but slow.
 */
export function redisCommandClientOptions(config: RedisConfig): RedisOptions {
  return {
    ...redisConnectionOptions(config),
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2_000,
    commandTimeout: 1_000,
    lazyConnect: false,
  };
}
