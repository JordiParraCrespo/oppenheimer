import { EventEmitter } from 'node:events';
import type { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { describe, expect, it, vi } from 'vitest';
import {
  channelOf,
  RedisWorkspaceEventsAdapter,
} from '../infrastructure/redis-workspace-events.adapter';

/** The subscriber connection the adapter opens: what it subscribed, and a way to deliver. */
const subscriber = vi.hoisted(() => {
  const state = { last: null as null | (EventEmitter & Record<string, unknown>) };
  return state;
});

vi.mock('ioredis', () => ({
  default: class {
    readonly subscribe = vi.fn(async () => undefined);
    readonly unsubscribe = vi.fn(async () => undefined);
    readonly quit = vi.fn(async () => undefined);
    readonly disconnect = vi.fn();
    private readonly emitter = new EventEmitter();
    constructor() {
      subscriber.last = this as never;
    }
    on(event: string, listener: (...args: unknown[]) => void) {
      this.emitter.on(event, listener);
      return this;
    }
    emit(event: string, ...args: unknown[]) {
      return this.emitter.emit(event, ...args);
    }
  },
}));

function setup() {
  const publish = vi.fn(async () => 1);
  const config = { get: () => ({ host: 'redis', port: 6379 }) } as unknown as ConfigService;
  const adapter = new RedisWorkspaceEventsAdapter({ publish } as unknown as Redis, config);
  const connection = () =>
    subscriber.last as unknown as {
      subscribe: ReturnType<typeof vi.fn>;
      unsubscribe: ReturnType<typeof vi.fn>;
      emit: (event: string, ...args: unknown[]) => void;
    };
  return { adapter, publish, connection };
}

describe('RedisWorkspaceEventsAdapter', () => {
  it("publishes on the audience's channel", () => {
    const { adapter, publish } = setup();
    adapter.publish({ organizationId: 'org-1' }, { type: 'session.changed', id: 's-1' });
    expect(publish).toHaveBeenCalledWith(
      'workspace-events:org:org-1',
      JSON.stringify({ type: 'session.changed', id: 's-1' }),
    );
    expect(channelOf({ userId: 'u-1' })).toBe('workspace-events:user:u-1');
  });

  it('never throws at a caller when Redis refuses the publish', async () => {
    const { adapter, publish } = setup();
    publish.mockRejectedValueOnce(new Error('down'));
    expect(() =>
      adapter.publish({ userId: 'u-1' }, { type: 'host.changed', id: 'h-1' }),
    ).not.toThrow();
    await Promise.resolve();
  });

  it("delivers a channel's messages to its listeners only", async () => {
    const { adapter, connection } = setup();
    const mine = vi.fn();
    const theirs = vi.fn();
    await adapter.subscribe([{ organizationId: 'org-1' }], mine);
    await adapter.subscribe([{ organizationId: 'org-2' }], theirs);

    const event = { type: 'session.changed', id: 's-1' };
    connection().emit('message', 'workspace-events:org:org-1', JSON.stringify(event));
    connection().emit('message', 'workspace-events:org:org-1', '{not json');
    connection().emit('message', 'workspace-events:org:org-1', JSON.stringify({ type: 'x' }));

    expect(mine).toHaveBeenCalledTimes(1);
    expect(mine).toHaveBeenCalledWith(event);
    expect(theirs).not.toHaveBeenCalled();
  });

  /** Two tabs of one workspace share a channel; the first to close must not deafen the other. */
  it('subscribes a channel once and unsubscribes it when its last listener leaves', async () => {
    const { adapter, connection } = setup();
    const offA = await adapter.subscribe([{ organizationId: 'org-1' }], vi.fn());
    const offB = await adapter.subscribe([{ organizationId: 'org-1' }], vi.fn());
    expect(connection().subscribe).toHaveBeenCalledTimes(1);

    offA();
    expect(connection().unsubscribe).not.toHaveBeenCalled();
    offB();
    expect(connection().unsubscribe).toHaveBeenCalledWith('workspace-events:org:org-1');
  });
});
