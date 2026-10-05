import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.di-tokens';
import type { LegacyReplayMarkerPort } from './legacy-replay-marker.port';

/**
 * {@link LegacyReplayMarkerPort} on the shared Redis connection. It reads the
 * raw key because `CacheService` now prefixes every key it is handed, and the
 * markers it has to find were written before it did. One `EXISTS`, read-only:
 * a legacy marker is never written again, only left to expire.
 *
 * TODO(remove after #162 has been live once): see the port.
 */
@Injectable()
export class RedisLegacyReplayMarker implements LegacyReplayMarkerPort {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async isBurned(hostId: string, jti: string): Promise<boolean> {
    return (await this.redis.exists(`host-assertion:jti:${hostId}:${jti}`)) > 0;
  }
}
