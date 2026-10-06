import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { type LiveEvent, liveEventSchema } from '@oppenheimer/shared/live';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.di-tokens';
import type { LiveEventListener, LiveEventsPort } from '../application/live-events.port';

const channelOf = (organizationId: string) => `live:org:${organizationId}`;

interface Channel {
  listeners: Set<LiveEventListener>;
  /** Settles once Redis confirmed the SUBSCRIBE; every listener waits on it. */
  ready: Promise<void>;
}

/**
 * Redis pub/sub. Publishing goes over the shared command client; hearing takes
 * a connection of its own, since a subscribed connection can send nothing
 * else. That connection subscribes to a workspace's channel while at least one
 * console of it is open on this replica, and leaves it when the last one goes.
 */
@Injectable()
export class RedisLiveEventsAdapter implements LiveEventsPort, OnApplicationShutdown {
  private readonly logger = new Logger(RedisLiveEventsAdapter.name);
  private readonly channels = new Map<string, Channel>();
  private subscriber: Redis | null = null;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async publish(organizationId: string, event: LiveEvent): Promise<void> {
    await this.redis.publish(channelOf(organizationId), JSON.stringify(event));
  }

  async subscribe(organizationId: string, listener: LiveEventListener): Promise<() => void> {
    const name = channelOf(organizationId);
    let channel = this.channels.get(name);
    if (!channel) {
      const ready = this.connection()
        .subscribe(name)
        .then(() => undefined);
      const created: Channel = { listeners: new Set(), ready };
      channel = created;
      this.channels.set(name, created);
      ready.catch(() => {
        if (this.channels.get(name) === created) this.channels.delete(name);
      });
    }
    await channel.ready;
    channel.listeners.add(listener);

    const joined = channel;
    return () => {
      joined.listeners.delete(listener);
      if (joined.listeners.size > 0 || this.channels.get(name) !== joined) return;
      this.channels.delete(name);
      this.subscriber?.unsubscribe(name).catch(() => undefined);
    };
  }

  async onApplicationShutdown(): Promise<void> {
    const subscriber = this.subscriber;
    if (!subscriber) return;
    await subscriber.quit().catch(() => subscriber.disconnect());
  }

  private connection(): Redis {
    if (this.subscriber) return this.subscriber;
    // The command client refuses a command while it is not connected; a
    // SUBSCRIBE sent the moment this connection is made has to wait for it.
    // The command timeout still bounds that wait.
    const subscriber = this.redis.duplicate({ enableOfflineQueue: true });
    subscriber.on('error', (error: Error) => {
      this.logger.warn({ message: 'Live events subscriber unavailable', error: error.message });
    });
    subscriber.on('message', (name: string, message: string) => this.deliver(name, message));
    this.subscriber = subscriber;
    return subscriber;
  }

  private deliver(name: string, message: string): void {
    const channel = this.channels.get(name);
    if (!channel) return;
    let payload: unknown;
    try {
      payload = JSON.parse(message);
    } catch {
      payload = undefined;
    }
    const parsed = liveEventSchema.safeParse(payload);
    if (!parsed.success) {
      this.logger.warn({ message: 'Dropped a malformed live event', channel: name });
      return;
    }
    for (const listener of channel.listeners) listener(parsed.data);
  }
}
