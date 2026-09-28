import { Global, Module } from '@nestjs/common';
import { RedisConnectionAdapter } from './infrastructure/redis-connection.adapter';
import { REDIS_CLIENT } from './redis.di-tokens';

/**
 * The shared Redis command connection, bound to `REDIS_CLIENT`.
 *
 * Global because it is infrastructure every Redis-backed adapter needs (the
 * cache, the throttler, the health probe) and none of them owns. Built from the
 * one `redis` config section; see `config/redis.config.ts`.
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
