import { Module } from '@nestjs/common';
import { RedisThrottlerStorage } from './infrastructure/redis-throttler.adapter';

/**
 * Owns the rate limiter's Redis-backed counter store.
 *
 * A module rather than an instance constructed inline in
 * `ThrottlerModule.forRootAsync` so the storage is a real provider, resolved
 * through the injector: that is how it receives the shared `REDIS_CLIENT`.
 * The connection itself belongs to `RedisModule`, which closes it on shutdown.
 */
@Module({
  providers: [RedisThrottlerStorage],
  exports: [RedisThrottlerStorage],
})
export class ThrottlingModule {}
