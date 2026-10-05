import type Redis from 'ioredis';
import { CacheService } from './cache.service';

export interface RedisCacheOptions {
  /**
   * Prepended to every key, so the cache has a namespace of its own in a Redis
   * database it shares with BullMQ (`bull:*`) and the rate limiter
   * (`throttle:*`). Default `cache:`.
   */
  keyPrefix?: string;
}

export const DEFAULT_CACHE_KEY_PREFIX = 'cache:';

/**
 * `CacheService` over a Redis client it is handed and does not own.
 *
 * - **The connection is the caller's.** The client is shared with other Redis
 *   users in the process, so this class never connects, configures or quits
 *   it; whoever built it closes it.
 * - **Keys are prefixed here**, per command, not with ioredis's client-level
 *   `keyPrefix`: that option would rewrite every other user's keys on the
 *   shared client too, including the rate limiter's Lua `KEYS`.
 * - **There is no flush** (see `CacheService`). If "drop the cache" is ever
 *   needed it must be `SCAN MATCH <prefix>* COUNT 500` and `UNLINK` in
 *   batches, never a flush of the whole database.
 */
export class RedisCacheService extends CacheService {
  private readonly prefix: string;
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly redis: Redis,
    options: RedisCacheOptions = {},
  ) {
    super();
    this.prefix = options.keyPrefix ?? DEFAULT_CACHE_KEY_PREFIX;
  }

  async get<T>(key: string): Promise<T | undefined> {
    return parse<T>(await this.redis.get(this.key(key)));
  }

  /** One `MGET`; an empty list answers without a round trip. */
  async mget<T>(keys: string[]): Promise<(T | undefined)[]> {
    if (keys.length === 0) return [];
    const values = await this.redis.mget(keys.map((key) => this.key(key)));
    return values.map((value) => parse<T>(value));
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.redis.set(this.key(key), serialized, 'EX', ttl);
    } else {
      await this.redis.set(this.key(key), serialized);
    }
  }

  /**
   * Single-flight is an in-process map of pending loads keyed by cache key; a
   * Redis lock would add a round trip to every miss to save at most one load
   * per replica.
   */
  async getOrSet<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    const running = this.inFlight.get(key);
    if (running) return running as Promise<T>;

    const promise = (async () => {
      const cached = await this.get<T>(key).catch(() => undefined);
      if (cached !== undefined) return cached;
      const value = await load();
      await this.set(key, value, ttlSeconds).catch(() => {});
      return value;
    })().finally(() => this.inFlight.delete(key));

    this.inFlight.set(key, promise);
    return promise;
  }

  /** `SET key value EX ttl NX` — one round trip, and Redis decides the race. */
  async setIfAbsent<T>(key: string, value: T, ttlSeconds: number): Promise<boolean> {
    const stored = await this.redis.set(
      this.key(key),
      JSON.stringify(value),
      'EX',
      ttlSeconds,
      'NX',
    );
    return stored === 'OK';
  }

  /** `GETDEL` — one round trip, so two redeemers cannot both read the value. */
  async take<T>(key: string): Promise<T | undefined> {
    return parse<T>(await this.redis.getdel(this.key(key)));
  }

  async del(key: string): Promise<void> {
    await this.redis.del(this.key(key));
  }

  private key(key: string): string {
    return this.prefix + key;
  }
}

/** Redis answers `null` for a missing key; `JSON.stringify` never yields `''`. */
function parse<T>(value: string | null): T | undefined {
  if (value === null) return undefined;
  return JSON.parse(value) as T;
}
