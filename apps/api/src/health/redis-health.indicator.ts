import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheckError, HealthIndicator, type HealthIndicatorResult } from '@nestjs/terminus';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private readonly redis: Redis;

  constructor(configService: ConfigService) {
    super();
    this.redis = new Redis({
      host: configService.get('redis.host'),
      port: configService.get('redis.port'),
      password: configService.get<string>('redis.password') || undefined,
      lazyConnect: true,
    });
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
