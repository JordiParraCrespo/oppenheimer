import { Module } from '@nestjs/common';
import { RedisThrottlerStorage } from './infrastructure/redis-throttler.adapter';

/**
 * Owns the rate limiter's Redis-backed counter store.
 *
 * A module rather than an instance constructed inline in
 * `ThrottlerModule.forRootAsync` so the storage is a real provider: that is
 * what gets its `onModuleDestroy` called, and therefore what closes the Redis
 * connection on shutdown instead of leaking it on every reload.
 */
@Module({
  providers: [RedisThrottlerStorage],
  exports: [RedisThrottlerStorage],
})
export class ThrottlingModule {}
