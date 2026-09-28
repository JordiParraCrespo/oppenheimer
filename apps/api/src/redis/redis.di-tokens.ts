/**
 * The API's one shared ioredis command client (`import type Redis from 'ioredis'`).
 *
 * Fail-fast (`redisCommandClientOptions`), owned and closed by `RedisModule`.
 * Consumers never `quit()` it. BullMQ does not use it: it opens its own
 * connections from the same `redisConnectionOptions`.
 */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
