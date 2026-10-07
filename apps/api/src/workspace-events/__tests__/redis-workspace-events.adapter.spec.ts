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
  const state = {
    last: null as null | (EventEmitter & Record<string, unknown>),
    /** When set, a `SUBSCRIBE` waits for it, as one Redis has not acknowledged yet does. */
    gate: null as null | Promise<void>,
  };
  return state;
});

vi.mock('ioredis', () => ({
  default: class {
    readonly subscribe = vi.fn(() => subscriber.gate ?? Promise.resolve());
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
  it("publishes on the audience's channel", async () => {
    const { adapter, publish } = setup();
    await adapter.publish({ organizationId: 'org-1' }, { type: 'session.changed', id: 's-1' });
    expect(publish).toHaveBeenCalledWith(
      'workspace-events:org:org-1',
      JSON.stringify({ type: 'session.changed', id: 's-1' }),
    );
    expect(channelOf({ userId: 'u-1' })).toBe('workspace-events:user:u-1');
  });

  /** The outbox delivers again only if it hears the publish failed. */
  it('rejects when Redis refuses the publish', async () => {
    const { adapter, publish } = setup();
    publish.mockRejectedValueOnce(new Error('down'));
    await expect(
      adapter.publish({ userId: 'u-1' }, { type: 'host.changed', id: 'h-1' }),
    ).rejects.toThrow('down');
  });

  it("delivers a channel's messages to its listeners only", async () => {
    const { adapter, connection } = setup();
    const mine = vi.fn();
    const theirs = vi.fn();
    await adapter.subscribe([{ organizationId: 'org-1' }], mine, vi.fn());
    await adapter.subscribe([{ organizationId: 'org-2' }], theirs, vi.fn());

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
    const offA = await adapter.subscribe([{ organizationId: 'org-1' }], vi.fn(), vi.fn());
    const offB = await adapter.subscribe([{ organizationId: 'org-1' }], vi.fn(), vi.fn());
    expect(connection().subscribe).toHaveBeenCalledTimes(1);
    expect(connection().subscribe).toHaveBeenCalledWith('workspace-events:org:org-1');

    offA();
    expect(connection().unsubscribe).not.toHaveBeenCalled();
    offB();
    expect(connection().unsubscribe).toHaveBeenCalledWith('workspace-events:org:org-1');
  });

  /**
   * The regression: the second of two tabs opening at once saw the channel
   * already listed, skipped the `SUBSCRIBE` and said `ready` before Redis had
   * acknowledged it, so a change in that gap never reached it.
   */
  it('makes a later listener wait for the subscription already in flight', async () => {
    const { adapter, connection } = setup();
    let acknowledge: () => void = () => {};
    subscriber.gate = new Promise<void>((resolve) => {
      acknowledge = resolve;
    });
    try {
      const first = adapter.subscribe([{ organizationId: 'org-1' }], vi.fn(), vi.fn());
      let secondReady = false;
      const second = adapter.subscribe([{ organizationId: 'org-1' }], vi.fn(), vi.fn()).then(() => {
        secondReady = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(secondReady).toBe(false);

      acknowledge();
      await Promise.all([first, second]);
      expect(secondReady).toBe(true);
      expect(connection().subscribe).toHaveBeenCalledTimes(1);
    } finally {
      subscriber.gate = null;
    }
  });

  /**
   * Nothing published while the connection was down reached this replica. A
   * stream left open on it would read live and hear nothing.
   */
  it('tells every listener once when its connection closes, and keeps none of its channels', async () => {
    const { adapter, connection } = setup();
    const lostA = vi.fn();
    const lostB = vi.fn();
    const heard = vi.fn();
    await adapter.subscribe([{ organizationId: 'org-1' }, { userId: 'u-1' }], heard, lostA);
    await adapter.subscribe([{ organizationId: 'org-1' }], vi.fn(), lostB);

    connection().emit('close');
    connection().emit(
      'message',
      'workspace-events:org:org-1',
      JSON.stringify({ type: 'session.changed', id: 's-1' }),
    );

    expect(lostA).toHaveBeenCalledTimes(1);
    expect(lostB).toHaveBeenCalledTimes(1);
    expect(heard).not.toHaveBeenCalled();
  });

  /** Once ioredis gives up, that connection never comes back; a stream on it would wait forever. */
  it('opens a new connection for the next stream once the old one has ended', async () => {
    const { adapter, connection } = setup();
    await adapter.subscribe([{ organizationId: 'org-1' }], vi.fn(), vi.fn());
    const ended = connection();

    ended.emit('close');
    ended.emit('end');
    await adapter.subscribe([{ organizationId: 'org-1' }], vi.fn(), vi.fn());

    expect(connection()).not.toBe(ended);
    expect(connection().subscribe).toHaveBeenCalledWith('workspace-events:org:org-1');
  });
});
