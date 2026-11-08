import type Redis from 'ioredis';
import { CacheService } from './cache.service';

/**
 * How one cached read went: the value was there (`hit`), was not (`miss`),
 * Redis failed (`error`), or a `getOrSet` joined a load already running for
 * the key (`coalesced`), which is a miss that cost no extra load.
 */
export type CacheReadResult = 'hit' | 'miss' | 'error' | 'coalesced';

/** The cache operations that read, the ones a hit rate is taken over. */
export type CacheReadOperation = 'get' | 'mget' | 'getOrSet' | 'take';

/**
 * Told about every key a read touches, so the app can count hits and misses
 * (`mget` reports once per key). `namespace` is the key's first segment, as
 * the caller wrote it (`github` for `github:repos:42`), never the whole key:
 * keys carry ids and tickets. It must not throw; a throw is swallowed.
 */
export type CacheReadObserver = (read: {
  operation: CacheReadOperation;
  namespace: string;
  result: CacheReadResult;
}) => void;

export interface RedisCacheOptions {
  /**
   * Prepended to every key, so the cache has a namespace of its own in a Redis
   * database it shares with BullMQ (`bull:*`) and the rate limiter
   * (`throttle:*`). Default `cache:`.
   */
  keyPrefix?: string;
  /** Told how each read went; absent, reads are not observed. */
  onRead?: CacheReadObserver;
}

const DEFAULT_CACHE_KEY_PREFIX = 'cache:';

/**
 * `KEYS[1]` keeps the larger of itself and `ARGV[1]`; only a write resets the
 * TTL (`ARGV[2]` seconds). Values are JSON, and a JSON number reads as a Lua
 * number, so the stored form is the one `get` parses.
 */
const SET_MAX_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]))
local candidate = tonumber(ARGV[1])
if current and current >= candidate then return tostring(current) end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
return ARGV[1]
`;

/** `KEYS[1]` grows by `ARGV[1]`; the add that creates it sets the TTL (`ARGV[2]` seconds). */
const INCREMENT_SCRIPT = `
local total = redis.call('INCRBY', KEYS[1], ARGV[1])
if total == tonumber(ARGV[1]) then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
return total
`;

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
  private readonly onRead: CacheReadObserver | undefined;

  constructor(
    private readonly redis: Redis,
    options: RedisCacheOptions = {},
  ) {
    super();
    this.prefix = options.keyPrefix ?? DEFAULT_CACHE_KEY_PREFIX;
    this.onRead = options.onRead;
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.observed('get', key, async () => parse<T>(await this.redis.get(this.key(key))));
  }

  /** One `MGET`; an empty list answers without a round trip. */
  async mget<T>(keys: string[]): Promise<(T | undefined)[]> {
    if (keys.length === 0) return [];
    let values: (string | null)[];
    try {
      values = await this.redis.mget(keys.map((key) => this.key(key)));
    } catch (error) {
      for (const key of keys) this.report('mget', key, 'error');
      throw error;
    }
    return values.map((value, index) => {
      const parsed = parse<T>(value);
      this.report('mget', keys[index] as string, parsed === undefined ? 'miss' : 'hit');
      return parsed;
    });
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
    if (running) {
      this.report('getOrSet', key, 'coalesced');
      return running as Promise<T>;
    }

    const promise = (async () => {
      const cached = await this.observed('getOrSet', key, async () =>
        parse<T>(await this.redis.get(this.key(key))),
      ).catch(() => undefined);
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
    return this.observed('take', key, async () => parse<T>(await this.redis.getdel(this.key(key))));
  }

  /** One `EVAL`, so the compare and the write cannot interleave with another replica's. */
  async setMax(key: string, value: number, ttlSeconds: number): Promise<number> {
    const kept = await this.redis.eval(
      SET_MAX_SCRIPT,
      1,
      this.key(key),
      JSON.stringify(value),
      Math.max(1, Math.ceil(ttlSeconds)),
    );
    return Number(kept);
  }

  /** One `EVAL`: the add and the TTL of a new key land together. */
  async incrementBy(key: string, by: number, ttlSeconds: number): Promise<number> {
    const total = await this.redis.eval(
      INCREMENT_SCRIPT,
      1,
      this.key(key),
      Math.trunc(by),
      Math.max(1, Math.ceil(ttlSeconds)),
    );
    return Number(total);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(this.key(key));
  }

  private key(key: string): string {
    return this.prefix + key;
  }

  /** Runs one read of `key` and reports whether it found a value, or failed. */
  private async observed<T>(
    operation: CacheReadOperation,
    key: string,
    read: () => Promise<T | undefined>,
  ): Promise<T | undefined> {
    let value: T | undefined;
    try {
      value = await read();
    } catch (error) {
      this.report(operation, key, 'error');
      throw error;
    }
    this.report(operation, key, value === undefined ? 'miss' : 'hit');
    return value;
  }

  private report(operation: CacheReadOperation, key: string, result: CacheReadResult): void {
    if (!this.onRead) return;
    try {
      this.onRead({ operation, namespace: cacheNamespace(key), result });
    } catch {
      // Observing a read never fails it.
    }
  }
}

/** A key's first `:`-separated segment: `github` for `github:repos:42`, the key itself when it has none. */
export function cacheNamespace(key: string): string {
  const end = key.indexOf(':');
  return end === -1 ? key : key.slice(0, end);
}

/** Redis answers `null` for a missing key; `JSON.stringify` never yields `''`. */
function parse<T>(value: string | null): T | undefined {
  if (value === null) return undefined;
  return JSON.parse(value) as T;
}
