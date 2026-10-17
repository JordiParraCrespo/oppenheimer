import { Inject, Injectable, Logger } from '@nestjs/common';
import type { BotStreamEvent } from '@oppenheimer/shared';
import type { RedisPubSubPort } from '../../redis/infrastructure/redis-pub-sub.port';
import { REDIS_PUB_SUB } from '../../redis/redis.di-tokens';
import type { BotStreamPort } from './bot-stream.port';

/** The Redis channel a bot's chat events are published on. */
export function botChannelOf(botId: string): string {
  return `bots:stream:${botId}`;
}

/**
 * A bot's chat on Redis pub/sub (`RedisPubSubPort`), the workspace stream's
 * transport: a channel per bot, shared by every chat open on it on this
 * replica. A publish Redis refuses is logged and dropped, since the stored
 * messages are the record.
 */
@Injectable()
export class RedisBotStreamAdapter implements BotStreamPort {
  private readonly logger = new Logger(RedisBotStreamAdapter.name);

  constructor(@Inject(REDIS_PUB_SUB) private readonly pubSub: RedisPubSubPort) {}

  async publish(botId: string, event: BotStreamEvent): Promise<void> {
    try {
      await this.pubSub.publish(botChannelOf(botId), event);
    } catch (error) {
      this.logger.warn({
        message: 'Could not publish to a bot stream',
        botId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  subscribe(
    botId: string,
    listener: (event: BotStreamEvent) => void,
    onLost: () => void,
  ): Promise<() => void> {
    return this.pubSub.subscribe(
      [botChannelOf(botId)],
      // Only this API publishes on the channel, in this shape.
      (payload) => listener(payload as BotStreamEvent),
      onLost,
    );
  }
}
