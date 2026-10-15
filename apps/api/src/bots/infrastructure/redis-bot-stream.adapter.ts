import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BotStreamEvent } from '@oppenheimer/shared';
import Redis from 'ioredis';
import { type RedisConfig, redisConnectionOptions } from '../../config/redis.config';
import { REDIS_CLIENT } from '../../redis/redis.di-tokens';
import type { BotStreamPort } from './bot-stream.port';

/** The Redis channel a bot's chat events are published on. */
export function botChannelOf(botId: string): string {
  return `bots:stream:${botId}`;
}

type Listener = (event: BotStreamEvent) => void;

interface Channel {
  listeners: Map<Listener, () => void>;
  subscribed: Promise<unknown>;
}

/**
 * Redis pub/sub for bot chats, the workspace stream's shape
 * (`RedisWorkspaceEventsAdapter`): publish on the shared command client,
 * subscribe on one connection of this replica's own, a channel per bot shared
 * by every chat open on it, and every listener told when the connection goes.
 */
@Injectable()
export class RedisBotStreamAdapter implements BotStreamPort, OnApplicationShutdown {
  private readonly logger = new Logger(RedisBotStreamAdapter.name);
  private readonly channels = new Map<string, Channel>();
  private subscriber: Redis | null = null;

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  async publish(botId: string, event: BotStreamEvent): Promise<void> {
    try {
      await this.redis.publish(botChannelOf(botId), JSON.stringify(event));
    } catch (error) {
      this.logger.warn({
        message: 'Could not publish to a bot stream',
        botId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async subscribe(botId: string, listener: Listener, onLost: () => void): Promise<() => void> {
    const subscriber = this.connection();
    const name = botChannelOf(botId);
    let channel = this.channels.get(name);
    if (!channel) {
      channel = { listeners: new Map(), subscribed: subscriber.subscribe(name) };
      this.channels.set(name, channel);
    }
    channel.listeners.set(listener, onLost);
    const unsubscribe = () => {
      const current = this.channels.get(name);
      if (!current?.listeners.delete(listener) || current.listeners.size > 0) return;
      this.channels.delete(name);
      void subscriber.unsubscribe(name).catch(() => undefined);
    };
    try {
      await channel.subscribed;
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
      this.logger.warn({ message: 'Redis unavailable to bot streams', error: error.message });
    });
    subscriber.on('close', () => this.dropAll());
    subscriber.on('end', () => {
      if (this.subscriber === subscriber) this.subscriber = null;
    });
    subscriber.on('message', (name: string, message: string) => {
      const listeners = this.channels.get(name)?.listeners;
      if (!listeners) return;
      let event: BotStreamEvent;
      try {
        event = JSON.parse(message) as BotStreamEvent;
      } catch {
        return;
      }
      for (const listener of listeners.keys()) listener(event);
    });
    this.subscriber = subscriber;
    return subscriber;
  }

  private dropAll(): void {
    const lost = new Set<() => void>();
    for (const channel of this.channels.values()) {
      for (const onLost of channel.listeners.values()) lost.add(onLost);
    }
    this.channels.clear();
    for (const onLost of lost) onLost();
  }
}
