import { Inject, Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, type HealthIndicatorResult } from '@nestjs/terminus';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.di-tokens';

/**
 * Pings the shared Redis command connection. That client fails fast, so with
 * Redis down the probe answers "down" at once instead of after ioredis's
 * retries, which is what a readiness probe wants.
 */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.redis.ping();
      return this.getStatus(key, true);
    } catch (_error) {
      throw new HealthCheckError('Redis health check failed', this.getStatus(key, false));
    }
  }
}
