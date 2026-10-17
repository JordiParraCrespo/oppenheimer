import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { type RedisConfig, redisConnectionOptions } from '../../config/redis.config';
import { REDIS_CLIENT } from '../redis.di-tokens';
import type { RedisPubSubPort } from './redis-pub-sub.port';

/** One `subscribe` call: who hears its channels, and how to tell them they are gone. */
interface Subscription {
  listener: (payload: unknown) => void;
  onLost: () => void;
}

/** One channel this replica listens on: its subscriptions, and its `SUBSCRIBE` while in flight. */
interface Channel {
  subscriptions: Set<Subscription>;
  subscribed: Promise<unknown>;
}

/**
 * Publishes on the shared command client and subscribes on one connection of
 * its own per replica, opened the first time a stream asks.
 *
 * A subscriber connection can do nothing else, and it must not fail fast the
 * way the command client does (`redisCommandClientOptions`): a subscription
 * waits for Redis rather than being refused, and a stream says `ready` only
 * once it is in place.
 *
 * Every stream on this replica shares the connection: a channel is subscribed
 * when its first listener arrives, every later listener waits for that same
 * `SUBSCRIBE`, and the channel is unsubscribed when its last listener leaves.
 *
 * When the connection closes, every channel goes with it and every
 * subscription is told (`onLost`). It does not resubscribe on its own: what
 * was published while it was down never reached this replica, so each stream
 * ends, the browser dials again, and reads again what the gap may have
 * changed.
 */
@Injectable()
export class RedisPubSubAdapter implements RedisPubSubPort, OnApplicationShutdown {
  private readonly logger = new Logger(RedisPubSubAdapter.name);
  private readonly channels = new Map<string, Channel>();
  private subscriber: Redis | null = null;

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  async publish(channel: string, payload: unknown): Promise<void> {
    await this.redis.publish(channel, JSON.stringify(payload));
  }

  async subscribe(
    channels: readonly string[],
    listener: (payload: unknown) => void,
    onLost: () => void,
  ): Promise<() => void> {
    const subscriber = this.connection();
    const names = [...new Set(channels)];
    const subscription: Subscription = { listener, onLost };
    const joined = names.map((name) => {
      let channel = this.channels.get(name);
      if (!channel) {
        channel = { subscriptions: new Set(), subscribed: subscriber.subscribe(name) };
        this.channels.set(name, channel);
      }
      channel.subscriptions.add(subscription);
      return channel;
    });
    const unsubscribe = () => {
      for (const name of names) {
        const channel = this.channels.get(name);
        if (!channel?.subscriptions.delete(subscription) || channel.subscriptions.size > 0) {
          continue;
        }
        this.channels.delete(name);
        void subscriber.unsubscribe(name).catch(() => undefined);
      }
    };
    try {
      await Promise.all(joined.map((channel) => channel.subscribed));
    } catch (error) {
      unsubscribe();
      throw error;
    }
    return unsubscribe;
  }

  async onApplicationShutdown(): Promise<void> {
    const subscriber = this.subscriber;
    this.subscriber = null;
    await subscriber?.quit().catch(() => subscriber.disconnect());
  }

  private connection(): Redis {
    if (this.subscriber) return this.subscriber;
    const subscriber = new Redis({
      ...redisConnectionOptions(this.configService.get('redis') as RedisConfig),
      autoResubscribe: false,
    });
    subscriber.on('error', (error: Error) => {
      this.logger.warn({ message: 'Redis unavailable to the live streams', error: error.message });
    });
    subscriber.on('close', () => this.dropAll());
    // Retries ran out and the connection will not come back: the next stream opens a new one.
    subscriber.on('end', () => {
      if (this.subscriber === subscriber) this.subscriber = null;
    });
    subscriber.on('message', (name: string, message: string) => {
      const subscriptions = this.channels.get(name)?.subscriptions;
      if (!subscriptions) return;
      let payload: unknown;
      try {
        payload = JSON.parse(message);
      } catch {
        return;
      }
      for (const { listener } of subscriptions) listener(payload);
    });
    this.subscriber = subscriber;
    return subscriber;
  }

  /** The connection closed: every channel is gone, and every subscription is told once. */
  private dropAll(): void {
    const lost = new Set<Subscription>();
    for (const channel of this.channels.values()) {
      for (const subscription of channel.subscriptions) lost.add(subscription);
    }
    this.channels.clear();
    for (const { onLost } of lost) onLost();
  }
}
