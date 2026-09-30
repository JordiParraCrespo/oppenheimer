import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { type RedisConfig, redisCommandClientOptions } from '../../config/redis.config';

/**
 * One owner, so `app.close()` leaves no socket behind. It closes in
 * `onApplicationShutdown`, which Nest runs after every module's
 * `onModuleDestroy`, so nothing still using it sees it go away.
 */
@Injectable()
export class RedisConnectionAdapter implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisConnectionAdapter.name);
  readonly client: Redis;

  constructor(configService: ConfigService) {
    this.client = new Redis(redisCommandClientOptions(configService.get('redis') as RedisConfig));

    // ioredis emits `error` on every failed reconnect attempt; without a
    // listener Node treats it as unhandled. The client reconnects on its own,
    // and each command fails fast meanwhile, so a warning is all it needs.
    this.client.on('error', (error: Error) => {
      this.logger.warn({ message: 'Redis unavailable', error: error.message });
    });
  }

  async onApplicationShutdown(): Promise<void> {
    // `quit` waits for pending replies; if Redis is already gone it rejects,
    // and the socket is dropped instead.
    await this.client.quit().catch(() => this.client.disconnect());
  }
}
