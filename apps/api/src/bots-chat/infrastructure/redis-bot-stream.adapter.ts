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

/** What every turn's own keys start with; the read script builds them from it. */
const TURN_KEY_PREFIX = 'bots:live:turn:';

/** The block a turn is writing, as written so far: a string, appended to. */
function textKeyOf(turnId: string): string {
  return `${TURN_KEY_PREFIX}${turnId}:text`;
}

/** Where the turn's text is: a hash of `seq` (its writes so far) and `block`. */
function placeKeyOf(turnId: string): string {
  return `${TURN_KEY_PREFIX}${turnId}:place`;
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

  /**
   * Every turn the bot keeps text for, in one round trip and one instant: a
   * turn whose place expired (its worker died) is dropped from the set.
   */
  private static readonly READ = `
    local out = {}
    for _, turnId in ipairs(redis.call('SMEMBERS', KEYS[1])) do
      local place = redis.call('HMGET', ARGV[1] .. turnId .. ':place', 'seq', 'block')
      if place[1] and place[2] then
        local text = redis.call('GET', ARGV[1] .. turnId .. ':text')
        table.insert(out, turnId)
        table.insert(out, text)
        table.insert(out, place[1])
        table.insert(out, place[2])
      else
        redis.call('SREM', KEYS[1], turnId)
      end
    end
    return out
  `;

  constructor(
    @Inject(REDIS_PUB_SUB) private readonly pubSub: RedisPubSubPort,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async publish(botId: string, event: BotStreamNudge): Promise<void> {
    await this.publishEvent(botId, event);
  }

  async write(botId: string, turnId: string, block: number, text: string): Promise<void> {
    let seq: number;
    try {
      seq = Number(
        await this.redis.eval(
          RedisBotStreamAdapter.WRITE,
          3,
          placeKeyOf(turnId),
          textKeyOf(turnId),
          turnsKeyOf(botId),
          block,
          text,
          BOT_LIVE_TEXT_TTL_SECONDS,
          turnId,
        ),
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
    let flat: (string | null)[];
    try {
      flat = (await this.redis.eval(
        RedisBotStreamAdapter.READ,
        1,
        turnsKeyOf(botId),
        TURN_KEY_PREFIX,
      )) as (string | null)[];
    } catch (error) {
      this.warn('Could not read a bot’s text in flight', botId, error);
      return [];
    }
    const snapshots: BotStreamSnapshot[] = [];
    for (let i = 0; i + 3 < flat.length; i += 4) {
      const [turnId, text, seq, block] = flat.slice(i, i + 4);
      snapshots.push({
        type: 'snapshot',
        turnId: turnId ?? '',
        block: Number(block),
        seq: Number(seq),
        text: text ?? '',
      });
    }
    return snapshots;
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
