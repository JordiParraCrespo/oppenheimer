import { Injectable } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CacheService } from './cache.service';

@Injectable()
export class RedisCacheService extends CacheService {
  private redis: Redis;

  constructor(private readonly configService: ConfigService) {
    super();
    this.redis = new Redis({
      host: this.configService.get('redis.host'),
      port: this.configService.get('redis.port'),
      // Optional — `REDIS_PASSWORD` in the root .env. Read here rather than at
      // one call site only, or a `requirepass` Redis accepts the queue and
      // refuses the cache.
      password: this.configService.get<string>('redis.password') || undefined,
    });
  }

  async get<T>(key: string): Promise<T | undefined> {
    const value = await this.redis.get(key);
    if (!value) return undefined;
    return JSON.parse(value) as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.redis.set(key, serialized, 'EX', ttl);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async reset(): Promise<void> {
    await this.redis.flushdb();
  }
}
