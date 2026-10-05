import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.di-tokens';

/**
 * The record `ThrottlerStorage.increment` must return.
 *
 * Derived from the interface rather than imported: the package does not
 * re-export `ThrottlerStorageRecord` from its root, and reaching into its
 * `dist/` would tie us to its build layout.
 */
type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

/** The shared client once the increment script is registered on it as a command. */
interface ThrottleRedis extends Redis {
  throttleIncrement(
    key: string,
    ttlMs: number,
    blockDurationMs: number,
    limit: number,
  ): Promise<[number, number, number, number]>;
}

/**
 * Rate-limit counters in Redis, so a limit means the same however many API replicas
 * run: the default in-process `Map` multiplies every limit by the replica count (the
 * default 100 per minute becomes 300 across three pods). Redis is already a hard
 * dependency (BullMQ, the cache).
 *
 * Not `CacheService`: a counter built from a get then a set is the race this class
 * removes; the increment is one atomic round trip. It runs on the shared
 * `REDIS_CLIENT`, which `RedisModule` owns and closes, under `throttle:*`, outside the
 * cache's `cache:` namespace.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);

  /**
   * Atomic, so two replicas incrementing the same key at the same instant
   * cannot both read "1".
   *
   * `PEXPIRE ... NX` is what keeps the window *fixed* rather than sliding: the
   * TTL is set only when the key is created, so a steady stream of requests
   * cannot keep pushing the expiry out and hold the counter open forever.
   */
  private static readonly INCREMENT = `
    local hits = redis.call('INCR', KEYS[1])
    if hits == 1 then
      redis.call('PEXPIRE', KEYS[1], ARGV[1])
    end
    local ttl = redis.call('PTTL', KEYS[1])

    local blocked = 0
    local blockTtl = 0
    if tonumber(ARGV[2]) > 0 and hits > tonumber(ARGV[3]) then
      blocked = 1
      -- A separate key so the block outlives the counting window when the
      -- configured block duration is longer than the window itself.
      local blockKey = KEYS[1] .. ':blocked'
      if redis.call('SET', blockKey, 1, 'PX', ARGV[2], 'NX') then
        blockTtl = tonumber(ARGV[2])
      else
        blockTtl = redis.call('PTTL', blockKey)
      end
    end

    return { hits, ttl, blocked, blockTtl }
  `;

  /**
   * The shared client fails fast (`redisCommandClientOptions`), so a rate
   * limiter is never the reason a request hangs: a Redis outage lands in the
   * catch in `increment`, which fails open.
   */
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    // Registered once per client: ioredis then sends `EVALSHA` with the
    // script's 40-byte hash, and falls back to `EVAL` itself on `NOSCRIPT`
    // (after a Redis restart or `SCRIPT FLUSH`), instead of shipping and
    // parsing the whole script on every request.
    if (!('throttleIncrement' in redis)) {
      redis.defineCommand('throttleIncrement', {
        numberOfKeys: 1,
        lua: RedisThrottlerStorage.INCREMENT,
      });
    }
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const storageKey = `throttle:${throttlerName}:${key}`;

    try {
      const [hits, ttlMs, blocked, blockTtlMs] = await (
        this.redis as ThrottleRedis
      ).throttleIncrement(storageKey, ttl, blockDuration, limit);

      return {
        totalHits: hits,
        timeToExpire: Math.ceil(Math.max(ttlMs, 0) / 1000),
        isBlocked: blocked === 1,
        timeToBlockExpire: Math.ceil(Math.max(blockTtlMs, 0) / 1000),
      };
    } catch (error) {
      /*
       * Fail open: a rate limiter sheds abusive load and must not be a second thing that
       * takes the API down, so an unreachable Redis serves the request. The counter is a
       * courtesy backstop; authentication is the control, and it does not depend on it.
       */
      this.logger.error(
        { message: 'Rate-limit counter unavailable; allowing the request', throttlerName },
        error instanceof Error ? error.stack : String(error),
      );
      return { totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 };
    }
  }
}
