import { describe, expect, it, vi } from 'vitest';
import type { RedisPubSubPort } from '../../redis/infrastructure/redis-pub-sub.port';
import {
  channelOf,
  RedisWorkspaceEventsAdapter,
} from '../infrastructure/redis-workspace-events.adapter';

/**
 * The workspace stream on the shared pub/sub: a channel per audience, a
 * refused publish reaching the outbox so it delivers again, and only what
 * reads as a workspace event passed on. The connection itself (one
 * `SUBSCRIBE` per channel, the subscription in flight, a closed connection)
 * is `redis-pub-sub.adapter.spec.ts`.
 */
function setup() {
  let deliver: (payload: unknown) => void = () => undefined;
  const pubSub = {
    publish: vi.fn(async () => undefined),
    subscribe: vi.fn(async (_channels: readonly string[], listener: (p: unknown) => void) => {
      deliver = listener;
      return () => undefined;
    }),
  } satisfies RedisPubSubPort;
  return {
    adapter: new RedisWorkspaceEventsAdapter(pubSub),
    pubSub,
    deliver: (payload: unknown) => deliver(payload),
  };
}

describe('RedisWorkspaceEventsAdapter', () => {
  it("publishes on the audience's channel", async () => {
    const { adapter, pubSub } = setup();
    const event = { type: 'session.changed', id: 's-1' } as const;
    await adapter.publish({ organizationId: 'org-1' }, event);
    expect(pubSub.publish).toHaveBeenCalledWith('workspace-events:org:org-1', event);
    expect(channelOf({ userId: 'u-1' })).toBe('workspace-events:user:u-1');
  });

  /** The outbox delivers again only if it hears the publish failed. */
  it('rejects when Redis refuses the publish', async () => {
    const { adapter, pubSub } = setup();
    pubSub.publish.mockRejectedValueOnce(new Error('down'));
    await expect(
      adapter.publish({ userId: 'u-1' }, { type: 'host.changed', id: 'h-1' }),
    ).rejects.toThrow('down');
  });

  it("listens on every audience's channel and passes on workspace events only", async () => {
    const { adapter, pubSub, deliver } = setup();
    const heard = vi.fn();
    const onLost = vi.fn();
    await adapter.subscribe([{ organizationId: 'org-1' }, { userId: 'u-1' }], heard, onLost);
    expect(pubSub.subscribe).toHaveBeenCalledWith(
      ['workspace-events:org:org-1', 'workspace-events:user:u-1'],
      expect.any(Function),
      onLost,
    );

    const event = { type: 'session.changed', id: 's-1' };
    deliver(event);
    deliver({ type: 'x' });
    expect(heard).toHaveBeenCalledTimes(1);
    expect(heard).toHaveBeenCalledWith(event);
  });
});
