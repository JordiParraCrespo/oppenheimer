import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.di-tokens';

/**
 * Pings the shared Redis command connection. That client fails fast, so with
 * Redis down the ping rejects at once instead of after ioredis's retries; a
 * Redis that accepts the socket and never answers is what the readiness
 * deadline is for.
 */
@Injectable()
export class RedisHealthIndicator {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async ping(): Promise<void> {
    await this.redis.ping();
  }
}
