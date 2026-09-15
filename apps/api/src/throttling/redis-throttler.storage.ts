import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

/**
 * The record `ThrottlerStorage.increment` must return.
 *
 * Derived from the interface rather than imported: the package does not
 * re-export `ThrottlerStorageRecord` from its root, and reaching into its
 * `dist/` would tie us to its build layout.
 */
type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

/**
 * Rate-limit counters in Redis, so the limit means the same thing however many
 * API replicas are running.
 *
 * The default storage is an in-process `Map`. With the Helm chart's replicas
 * that silently multiplies every limit by the replica count — a documented
 * "120 per minute" becomes 360 across three pods, and nobody finds out from
 * reading the decorator. Redis is already a hard dependency here (BullMQ and
 * the cache both use it), so there is no new infrastructure to run.
 *
 * `CacheService` is deliberately not reused: it offers get/set, and a counter
 * built from a read followed by a write is exactly the race this class exists
 * to remove. The increment below is a single atomic round trip.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly redis: Redis;

  /**
   * Increment the hit counter, set its expiry on first write, and report the
   * block state — atomically, so two replicas incrementing the same key at the
   * same instant cannot both read "1".
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

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get('redis.host'),
      port: this.configService.get('redis.port'),
      password: this.configService.get<string>('redis.password') || undefined,
      // Never let a rate limiter be the reason a request hangs. Failing fast
      // here lands in the catch below, which fails open — see `increment`.
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: false,
    });

    // ioredis emits `error` on every reconnect attempt; without a listener Node
    // treats it as an unhandled exception and takes the process down.
    this.redis.on('error', (error: Error) => {
      this.logger.warn({ message: 'Throttler Redis unavailable', error: error.message });
    });
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
      const [hits, ttlMs, blocked, blockTtlMs] = (await this.redis.eval(
        RedisThrottlerStorage.INCREMENT,
        1,
        storageKey,
        ttl,
        blockDuration,
        limit,
      )) as [number, number, number, number];

      return {
        totalHits: hits,
        timeToExpire: Math.ceil(Math.max(ttlMs, 0) / 1000),
        isBlocked: blocked === 1,
        timeToBlockExpire: Math.ceil(Math.max(blockTtlMs, 0) / 1000),
      };
    } catch (error) {
      /*
       * Fail **open**.
       *
       * A rate limiter exists to shed abusive load, not to be a second thing
       * that can take the API down. If Redis is unreachable the honest choice
       * is to serve the request: refusing every caller because the counter is
       * unavailable converts a cache outage into a total outage, and on this
       * endpoint specifically it would drop real customer enquiries on the
       * floor. The counter is a courtesy backstop; authentication and the
       * proof-of-human check at the edge are the actual controls, and neither
       * depends on this.
       */
      this.logger.error(
        { message: 'Rate-limit counter unavailable; allowing the request', throttlerName },
        error instanceof Error ? error.stack : String(error),
      );
      return { totalHits: 0, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 };
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
