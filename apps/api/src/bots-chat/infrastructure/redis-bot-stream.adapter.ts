import { Inject, Injectable, Logger } from '@nestjs/common';
import type { BotStreamEvent, BotStreamSnapshot } from '@oppenheimer/shared';
import type Redis from 'ioredis';
import type { RedisPubSubPort } from '../../redis/infrastructure/redis-pub-sub.port';
import { REDIS_CLIENT, REDIS_PUB_SUB } from '../../redis/redis.di-tokens';
import type { BotStreamNudge, BotStreamPort } from './bot-stream.port';

/** The Redis channel a bot's chat events are published on. */
export function botChannelOf(botId: string): string {
  return `bots:stream:${botId}`;
}

/** The turns of a bot that have text kept: a set of turn ids. */
function turnsKeyOf(botId: string): string {
  return `bots:live:${botId}:turns`;
}

/** The block a turn is writing, as written so far: a string, appended to. */
function textKeyOf(turnId: string): string {
  return `bots:live:turn:${turnId}:text`;
}

/** Where the turn's text is: a hash of `seq` (its writes so far) and `block`. */
function placeKeyOf(turnId: string): string {
  return `bots:live:turn:${turnId}:place`;
}

/** The shared client, with {@link RedisBotStreamAdapter}'s script defined on it. */
interface LiveTextRedis extends Redis {
  botLiveWrite(
    placeKey: string,
    textKey: string,
    turnsKey: string,
    block: number,
    text: string,
    ttlSeconds: number,
    turnId: string,
  ): Promise<number>;
}

/**
 * How long a turn's kept text outlives its last write. Far past a turn's time
 * limit: it is only there for a worker that died before it could forget.
 */
export const BOT_LIVE_TEXT_TTL_SECONDS = 60 * 60;

/**
 * A bot's chat on Redis pub/sub (`RedisPubSubPort`), the workspace stream's
 * transport: a channel per bot, shared by every chat open on it on this
 * replica. A publish Redis refuses is logged and dropped, since the stored
 * messages are the record.
 *
 * Beside the channel, the block a turn is writing is kept on the command
 * client until it is stored: each delta is appended and given the turn's
 * next `seq` in one script, then published with it. A chat that connects
 * reads it whole ({@link inFlight}) and drops the deltas it already holds.
 */
@Injectable()
export class RedisBotStreamAdapter implements BotStreamPort {
  private readonly logger = new Logger(RedisBotStreamAdapter.name);

  /**
   * One delta, atomically: the turn's next `seq`, the block it belongs to, and
   * its text added to the block's (or in place of it, when it starts a new
   * block). Atomic because a chat reading the block between the count and the
   * text would hold a `seq` whose text it lacks, and drop the delta as one it
   * has.
   */
  private static readonly WRITE = `
    local previous = redis.call('HGET', KEYS[1], 'block')
    local seq = redis.call('HINCRBY', KEYS[1], 'seq', 1)
    redis.call('HSET', KEYS[1], 'block', ARGV[1])
    if previous == ARGV[1] then
      redis.call('APPEND', KEYS[2], ARGV[2])
    else
      redis.call('SET', KEYS[2], ARGV[2])
    end
    redis.call('EXPIRE', KEYS[1], ARGV[3])
    redis.call('EXPIRE', KEYS[2], ARGV[3])
    redis.call('SADD', KEYS[3], ARGV[4])
    redis.call('EXPIRE', KEYS[3], ARGV[3])
    return seq
  `;

  constructor(
    @Inject(REDIS_PUB_SUB) private readonly pubSub: RedisPubSubPort,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    // Registered once per client, as `RedisThrottlerStorage` does: `EVALSHA` after the first.
    if (!('botLiveWrite' in redis)) {
      redis.defineCommand('botLiveWrite', {
        numberOfKeys: 3,
        lua: RedisBotStreamAdapter.WRITE,
      });
    }
  }

  async publish(botId: string, event: BotStreamNudge): Promise<void> {
    await this.publishEvent(botId, event);
  }

  async write(botId: string, turnId: string, block: number, text: string): Promise<void> {
    let seq: number;
    try {
      seq = await (this.redis as LiveTextRedis).botLiveWrite(
        placeKeyOf(turnId),
        textKeyOf(turnId),
        turnsKeyOf(botId),
        block,
        text,
        BOT_LIVE_TEXT_TTL_SECONDS,
        turnId,
      );
    } catch (error) {
      this.warn('Could not keep a bot turn’s text', botId, error);
      return;
    }
    await this.publishEvent(botId, { type: 'text', turnId, block, seq, text });
  }

  async settle(botId: string, turnId: string): Promise<void> {
    try {
      await this.redis.del(textKeyOf(turnId));
    } catch (error) {
      this.warn('Could not settle a bot turn’s text', botId, error);
    }
  }

  async forget(botId: string, turnId: string): Promise<void> {
    try {
      await this.redis
        .multi()
        .del(textKeyOf(turnId), placeKeyOf(turnId))
        .srem(turnsKeyOf(botId), turnId)
        .exec();
    } catch (error) {
      this.warn('Could not forget a bot turn’s text', botId, error);
    }
  }

  async inFlight(botId: string): Promise<BotStreamSnapshot[]> {
    try {
      const turnIds = await this.redis.smembers(turnsKeyOf(botId));
      const snapshots: BotStreamSnapshot[] = [];
      for (const turnId of turnIds) {
        const results = await this.redis
          .multi()
          .get(textKeyOf(turnId))
          .hmget(placeKeyOf(turnId), 'seq', 'block')
          .exec();
        const text = results?.[0]?.[1] as string | null;
        const [seq, block] = (results?.[1]?.[1] ?? []) as (string | null)[];
        // Its place expired: a worker died under it, and there is nothing to read.
        if (seq == null || block == null) continue;
        snapshots.push({
          type: 'snapshot',
          turnId,
          block: Number(block),
          seq: Number(seq),
          text: text ?? '',
        });
      }
      return snapshots;
    } catch (error) {
      this.warn('Could not read a bot’s text in flight', botId, error);
      return [];
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

  private async publishEvent(botId: string, event: BotStreamEvent): Promise<void> {
    try {
      await this.pubSub.publish(botChannelOf(botId), event);
    } catch (error) {
      this.warn('Could not publish to a bot stream', botId, error);
    }
  }

  private warn(message: string, botId: string, error: unknown): void {
    this.logger.warn({
      message,
      botId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
