import { Inject, Injectable } from '@nestjs/common';
import { isWorkspaceEvent, type WorkspaceEvent } from '@oppenheimer/shared/workspace-events';
import type { RedisPubSubPort } from '../../redis/infrastructure/redis-pub-sub.port';
import { REDIS_PUB_SUB } from '../../redis/redis.di-tokens';
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

/**
 * The workspace stream on Redis pub/sub (`RedisPubSubPort`): a channel per
 * audience, and only what reads as a workspace event passed on.
 *
 * A publish that Redis refuses rejects, so the outbox delivers the event
 * again. A connection that goes tells every stream (`onLost`), which ends,
 * and the console reads again what the gap may have changed: a console that
 * stops polling while its stream is up depends on it.
 */
@Injectable()
export class RedisWorkspaceEventsAdapter implements WorkspaceEventBusPort {
  constructor(@Inject(REDIS_PUB_SUB) private readonly pubSub: RedisPubSubPort) {}

  async publish(audience: WorkspaceEventAudience, event: WorkspaceEvent): Promise<void> {
    await this.pubSub.publish(channelOf(audience), event);
  }

  subscribe(
    audiences: readonly WorkspaceEventAudience[],
    listener: (event: WorkspaceEvent) => void,
    onLost: () => void,
  ): Promise<() => void> {
    return this.pubSub.subscribe(
      audiences.map(channelOf),
      (payload) => {
        if (isWorkspaceEvent(payload)) listener(payload);
      },
      onLost,
    );
  }
}
