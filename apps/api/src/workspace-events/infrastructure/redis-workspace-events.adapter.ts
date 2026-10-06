import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isWorkspaceEvent, type WorkspaceEvent } from '@oppenheimer/shared/workspace-events';
import Redis from 'ioredis';
import { type RedisConfig, redisConnectionOptions } from '../../config/redis.config';
import { REDIS_CLIENT } from '../../redis/redis.di-tokens';
import type {
  WorkspaceEventAudience,
  WorkspaceEventBusPort,
} from '../application/workspace-event-bus.port';

/** The Redis channel an audience's events are published on. */
export function channelOf(audience: WorkspaceEventAudience): string {
  return 'organizationId' in audience
    ? `workspace-events:org:${audience.organizationId}`
    : `workspace-events:user:${audience.userId}`;
}

type Listener = (event: WorkspaceEvent) => void;

/** One channel this replica listens on: who hears it (and how to tell them it is gone), and its `SUBSCRIBE` while in flight. */
interface Channel {
  listeners: Map<Listener, () => void>;
  subscribed: Promise<unknown>;
}

/**
 * Redis pub/sub: publish on the shared command client, subscribe on one
 * connection of its own per replica, opened the first time a stream asks.
 *
 * A publish that Redis refuses rejects, so the outbox delivers the event
 * again. A subscriber connection can do nothing else, and it must not fail
 * fast the way the command client does (`redisCommandClientOptions`): a
 * subscription waits for Redis rather than being refused, and a stream says
 * `ready` only once it is in place.
 *
 * Every stream on this replica shares the connection: a channel is subscribed
 * when its first listener arrives, every later listener waits for that same
 * `SUBSCRIBE`, and the channel is unsubscribed when its last listener leaves.
 *
 * When the connection closes, every channel goes with it and every listener
 * is told (`onLost`). It does not resubscribe on its own: what was published
 * while it was down never reached this replica, so each stream ends, the
 * browser dials again, and the console reads again what the gap may have
 * changed. A console that stops polling while its stream is up depends on it.
 */
@Injectable()
export class RedisWorkspaceEventsAdapter implements WorkspaceEventBusPort, OnApplicationShutdown {
  private readonly logger = new Logger(RedisWorkspaceEventsAdapter.name);
  private readonly channels = new Map<string, Channel>();
  private subscriber: Redis | null = null;

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  async publish(audience: WorkspaceEventAudience, event: WorkspaceEvent): Promise<void> {
    await this.redis.publish(channelOf(audience), JSON.stringify(event));
  }

  async subscribe(
    audiences: readonly WorkspaceEventAudience[],
    listener: Listener,
    onLost: () => void,
  ): Promise<() => void> {
    const subscriber = this.connection();
    const names = [...new Set(audiences.map(channelOf))];
    const joined = names.map((name) => {
      let channel = this.channels.get(name);
      if (!channel) {
        channel = { listeners: new Map(), subscribed: subscriber.subscribe(name) };
        this.channels.set(name, channel);
      }
      channel.listeners.set(listener, onLost);
      return channel;
    });
    const unsubscribe = () => {
      for (const name of names) {
        const channel = this.channels.get(name);
        if (!channel?.listeners.delete(listener) || channel.listeners.size > 0) continue;
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
      this.logger.warn({
        message: 'Redis unavailable to the workspace stream',
        error: error.message,
      });
    });
    subscriber.on('close', () => this.dropAll());
    // Retries ran out and the connection will not come back: the next stream opens a new one.
    subscriber.on('end', () => {
      if (this.subscriber === subscriber) this.subscriber = null;
    });
    subscriber.on('message', (name: string, message: string) => {
      const listeners = this.channels.get(name)?.listeners;
      if (!listeners) return;
      let event: unknown;
      try {
        event = JSON.parse(message);
      } catch {
        return;
      }
      if (!isWorkspaceEvent(event)) return;
      for (const listener of listeners.keys()) listener(event);
    });
    this.subscriber = subscriber;
    return subscriber;
  }

  /** The connection closed: every channel is gone, and every listener is told once. */
  private dropAll(): void {
    const lost = new Set<() => void>();
    for (const channel of this.channels.values()) {
      for (const onLost of channel.listeners.values()) lost.add(onLost);
    }
    this.channels.clear();
    for (const onLost of lost) onLost();
  }
}
