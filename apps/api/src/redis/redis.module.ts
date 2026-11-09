import { Global, Module } from '@nestjs/common';
import { createMetricsProvider } from '@oppenheimer/backend-core';
import { CacheMetrics, CacheReadMetricsAdapter } from './infrastructure/cache-metrics.adapter';
import { RedisConnectionAdapter } from './infrastructure/redis-connection.adapter';
import { RedisPubSubAdapter } from './infrastructure/redis-pub-sub.adapter';
import { REDIS_CLIENT, REDIS_PUB_SUB } from './redis.di-tokens';

/**
 * Global because it is infrastructure every Redis-backed adapter needs (the
 * cache and its read metrics, the throttler, the health probe, the live streams' pub/sub) and none
 * of them owns.
 */
@Global()
@Module({
  providers: [
    RedisConnectionAdapter,
    {
      provide: REDIS_CLIENT,
      inject: [RedisConnectionAdapter],
      useFactory: (connection: RedisConnectionAdapter) => connection.client,
    },
    { provide: REDIS_PUB_SUB, useClass: RedisPubSubAdapter },
    ...createMetricsProvider(CacheMetrics),
    CacheReadMetricsAdapter,
  ],
  exports: [REDIS_CLIENT, REDIS_PUB_SUB, CacheReadMetricsAdapter],
})
export class RedisModule {}
