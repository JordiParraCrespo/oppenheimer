import { Global, Module } from '@nestjs/common';
import { AUTH_FAILURE_LIMITER } from '../auth/auth.di-tokens';
import { RedisAuthFailureLimiter } from './infrastructure/redis-auth-failure-limiter.adapter';
import { RedisThrottlerStorage } from './infrastructure/redis-throttler.adapter';

/**
 * Owns the rate limiter's Redis-backed counter store and the auth-failure budget built
 * on it. A module, not an inline instance in `ThrottlerModule.forRootAsync`, so the
 * storage is resolved through the injector and receives the shared `REDIS_CLIENT`.
 *
 * `@Global` for the one binding the auth kernel asks for: it counts refused
 * credentials through `AUTH_FAILURE_LIMITER` and may not import this module
 * (`auth-is-a-kernel`).
 */
@Global()
@Module({
  providers: [
    RedisThrottlerStorage,
    { provide: AUTH_FAILURE_LIMITER, useClass: RedisAuthFailureLimiter },
  ],
  exports: [RedisThrottlerStorage, AUTH_FAILURE_LIMITER],
})
export class ThrottlingModule {}
