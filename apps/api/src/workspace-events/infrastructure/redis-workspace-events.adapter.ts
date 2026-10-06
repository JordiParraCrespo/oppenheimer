import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isWorkspaceEvent, type WorkspaceEvent } from '@oppenheimer/shared/workspace-events';
import Redis from 'ioredis';
import { type RedisConfig, redisConnectionOptions } from '../../config/redis.config';
import { REDIS_CLIENT } from '../../redis/redis.di-tokens';
import type {
  WorkspaceEventAudience,
  WorkspaceEventFeedPort,
  WorkspaceEventsPort,
} from '../application/workspace-events.port';

/** The Redis channel an audience's events are published on. */
export function channelOf(audience: WorkspaceEventAudience): string {
  return 'organizationId' in audience
    ? `workspace-events:org:${audience.organizationId}`
    : `workspace-events:user:${audience.userId}`;
}

type Listener = (event: WorkspaceEvent) => void;

/**
 * Redis pub/sub: publish on the shared command client, subscribe on one
 * connection of its own per replica, opened the first time a stream asks.
 *
 * A subscriber connection can do nothing else, and it must not fail fast the
 * way the command client does (`redisCommandClientOptions`): a subscription
 * waits for Redis rather than being refused, and a stream says `ready` only
 * once it is in place, so while Redis is down the console keeps polling. The
 * connection resubscribes on its own after a reconnect; the streams that were
 * open saw nothing in between and are told so by their reconnect.
 *
 * Every stream on this replica shares the connection: a channel is subscribed
 * when its first listener arrives and unsubscribed when its last one leaves.
 */
@Injectable()
export class RedisWorkspaceEventsAdapter
  implements WorkspaceEventsPort, WorkspaceEventFeedPort, OnApplicationShutdown
{
  private readonly logger = new Logger(RedisWorkspaceEventsAdapter.name);
  private readonly listeners = new Map<string, Set<Listener>>();
  private subscriber: Redis | null = null;

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  publish(audience: WorkspaceEventAudience, event: WorkspaceEvent): void {
    this.redis.publish(channelOf(audience), JSON.stringify(event)).catch((error: Error) => {
      this.logger.warn({
        message: 'a workspace event was not published',
        type: event.type,
        error: error.message,
      });
    });
  }

  async subscribe(
    audiences: readonly WorkspaceEventAudience[],
    listener: Listener,
  ): Promise<() => void> {
    const subscriber = this.connection();
    const channels = [...new Set(audiences.map(channelOf))];
    const fresh: string[] = [];
    for (const channel of channels) {
      let set = this.listeners.get(channel);
      if (!set) {
        set = new Set();
        this.listeners.set(channel, set);
        fresh.push(channel);
      }
      set.add(listener);
    }
    const unsubscribe = () => {
      const gone: string[] = [];
      for (const channel of channels) {
        const set = this.listeners.get(channel);
        if (!set?.delete(listener) || set.size > 0) continue;
        this.listeners.delete(channel);
        gone.push(channel);
      }
      if (gone.length > 0) void subscriber.unsubscribe(...gone).catch(() => undefined);
    };
    try {
      // A channel another stream already holds is subscribed: only the new ones wait.
      if (fresh.length > 0) await subscriber.subscribe(...fresh);
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
    const subscriber = new Redis(
      redisConnectionOptions(this.configService.get('redis') as RedisConfig),
    );
    subscriber.on('error', (error: Error) => {
      this.logger.warn({
        message: 'Redis unavailable to the workspace stream',
        error: error.message,
      });
    });
    subscriber.on('message', (channel: string, message: string) => {
      const listeners = this.listeners.get(channel);
      if (!listeners) return;
      let event: unknown;
      try {
        event = JSON.parse(message);
      } catch {
        return;
      }
      if (!isWorkspaceEvent(event)) return;
      for (const listener of listeners) listener(event);
    });
    this.subscriber = subscriber;
    return subscriber;
  }
}
