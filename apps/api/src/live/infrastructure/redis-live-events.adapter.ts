import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { type LiveEvent, liveEventSchema } from '@oppenheimer/shared/live';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.di-tokens';
import type { LiveEventListener, LiveEventsPort } from '../application/live-events.port';

const channelOf = (organizationId: string) => `live:org:${organizationId}`;

interface Channel {
  /** Every console of the workspace on this replica, including ones still joining. */
  listeners: Set<LiveEventListener>;
  /** Settles once Redis confirmed the SUBSCRIBE. */
  ready: Promise<void>;
}

/**
 * Redis pub/sub. Publishing goes over the shared command client; hearing takes
 * a connection of its own, since a subscribed connection can send nothing
 * else. That connection subscribes to a workspace's channel while at least one
 * console of it is open on this replica, and leaves it when the last one goes.
 *
 * When that connection drops, every channel is dropped with it and every
 * listener is told: a console must not read "live" over a dead bus, with its
 * polls off. Its next dial subscribes afresh, or is refused while Redis is down.
 */
@Injectable()
export class RedisLiveEventsAdapter implements LiveEventsPort, OnApplicationShutdown {
  private readonly logger = new Logger(RedisLiveEventsAdapter.name);
  private readonly channels = new Map<string, Channel>();
  private subscriber: Redis | null = null;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async publish(organizationId: string, event: LiveEvent): Promise<void> {
    try {
      await this.redis.publish(channelOf(organizationId), JSON.stringify(event));
    } catch (error) {
      this.logger.warn({
        message: 'Could not publish a live event',
        organizationId,
        type: event.type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async subscribe(organizationId: string, listener: LiveEventListener): Promise<() => void> {
    const name = channelOf(organizationId);
    let channel = this.channels.get(name);
    if (!channel) {
      const ready = this.connection()
        .subscribe(name)
        .then(() => undefined);
      channel = { listeners: new Set(), ready };
      this.channels.set(name, channel);
    }
    // A member before the wait, so the last console leaving meanwhile cannot
    // unsubscribe the channel out from under this one.
    const joined = channel;
    joined.listeners.add(listener);
    const leave = () => {
      joined.listeners.delete(listener);
      if (joined.listeners.size > 0 || this.channels.get(name) !== joined) return;
      this.channels.delete(name);
      this.subscriber?.unsubscribe(name).catch(() => undefined);
    };
    try {
      await joined.ready;
    } catch (error) {
      leave();
      throw error;
    }
    return leave;
  }

  async onApplicationShutdown(): Promise<void> {
    const subscriber = this.subscriber;
    if (!subscriber) return;
    await subscriber.quit().catch(() => subscriber.disconnect());
  }

  private connection(): Redis {
    if (this.subscriber) return this.subscriber;
    // The command client refuses a command while it is not connected; a
    // SUBSCRIBE sent the moment this connection is made has to wait for it,
    // within the command timeout. It never resubscribes on its own: a dropped
    // connection drops every channel, and each console dials again.
    const subscriber = this.redis.duplicate({ enableOfflineQueue: true, autoResubscribe: false });
    subscriber.on('error', (error: Error) => {
      this.logger.warn({ message: 'Live events subscriber unavailable', error: error.message });
    });
    subscriber.on('close', () => this.dropAll());
    subscriber.on('message', (name: string, message: string) => this.deliver(name, message));
    this.subscriber = subscriber;
    return subscriber;
  }

  private dropAll(): void {
    const dropped = [...this.channels.values()];
    this.channels.clear();
    for (const channel of dropped) {
      for (const listener of channel.listeners) listener.lost();
    }
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
    for (const listener of channel.listeners) listener.event(parsed.data);
  }
}
