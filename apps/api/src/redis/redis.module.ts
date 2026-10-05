import { Global, Module } from '@nestjs/common';
import { RedisConnectionAdapter } from './infrastructure/redis-connection.adapter';
import { REDIS_CLIENT } from './redis.di-tokens';

/**
 * Global because it is infrastructure every Redis-backed adapter needs (the
 * cache, the throttler, the health probe) and none of them owns.
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
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
