import { EventEmitter } from 'node:events';
import type { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { describe, expect, it, vi } from 'vitest';
import { RedisPubSubAdapter } from '../infrastructure/redis-pub-sub.adapter';

/**
 * The live streams' one subscriber connection per replica: a channel
 * subscribed once and dropped with its last listener, a later listener
 * waiting for the `SUBSCRIBE` in flight, JSON parsed once and the rest
 * dropped, every subscription told once when the connection closes, and a
 * new connection once the old one has ended. What each stream passes on is
 * its adapter's spec (`redis-workspace-events.adapter.spec.ts`).
 */
const subscriber = vi.hoisted(() => {
  const state = {
    last: null as null | (EventEmitter & Record<string, unknown>),
    opened: 0,
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
      subscriber.opened += 1;
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
  const pubSub = new RedisPubSubAdapter({ publish } as unknown as Redis, config);
  const connection = () =>
    subscriber.last as unknown as {
      subscribe: ReturnType<typeof vi.fn>;
      unsubscribe: ReturnType<typeof vi.fn>;
      quit: ReturnType<typeof vi.fn>;
      emit: (event: string, ...args: unknown[]) => void;
    };
  return { pubSub, publish, connection };
}

describe('RedisPubSubAdapter', () => {
  it('publishes the payload as JSON on the command client, and rejects when Redis refuses', async () => {
    const { pubSub, publish } = setup();
    const before = subscriber.opened;
    await pubSub.publish('bots:stream:b-1', { type: 'text', text: 'hi' });
    expect(publish).toHaveBeenCalledWith('bots:stream:b-1', '{"type":"text","text":"hi"}');
    expect(subscriber.opened).toBe(before);
    publish.mockRejectedValueOnce(new Error('down'));
    await expect(pubSub.publish('c', {})).rejects.toThrow('down');
  });

  it("passes a channel's JSON messages, parsed, to its listeners only", async () => {
    const { pubSub, connection } = setup();
    const mine = vi.fn();
    const theirs = vi.fn();
    await pubSub.subscribe(['a'], mine, vi.fn());
    await pubSub.subscribe(['b'], theirs, vi.fn());

    connection().emit('message', 'a', '{"n":1}');
    connection().emit('message', 'a', '{not json');

    expect(mine).toHaveBeenCalledTimes(1);
    expect(mine).toHaveBeenCalledWith({ n: 1 });
    expect(theirs).not.toHaveBeenCalled();
  });

  /** Two tabs of one chat share a channel; the first to close must not deafen the other. */
  it('subscribes a channel once and unsubscribes it when its last listener leaves', async () => {
    const { pubSub, connection } = setup();
    const offA = await pubSub.subscribe(['a'], vi.fn(), vi.fn());
    const offB = await pubSub.subscribe(['a', 'a'], vi.fn(), vi.fn());
    expect(connection().subscribe).toHaveBeenCalledTimes(1);
    expect(connection().subscribe).toHaveBeenCalledWith('a');

    offA();
    expect(connection().unsubscribe).not.toHaveBeenCalled();
    offB();
    expect(connection().unsubscribe).toHaveBeenCalledWith('a');
  });

  /**
   * The regression: the second of two tabs opening at once saw the channel
   * already listed, skipped the `SUBSCRIBE` and said `ready` before Redis had
   * acknowledged it, so a change in that gap never reached it.
   */
  it('makes a later listener wait for the subscription already in flight', async () => {
    const { pubSub, connection } = setup();
    let acknowledge: () => void = () => {};
    subscriber.gate = new Promise<void>((resolve) => {
      acknowledge = resolve;
    });
    try {
      const first = pubSub.subscribe(['a'], vi.fn(), vi.fn());
      let secondReady = false;
      const second = pubSub.subscribe(['a'], vi.fn(), vi.fn()).then(() => {
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

  it('leaves no channel behind when the subscription is refused', async () => {
    const { pubSub, connection } = setup();
    await pubSub.subscribe(['warm'], vi.fn(), vi.fn());
    connection().subscribe.mockRejectedValueOnce(new Error('refused'));
    await expect(pubSub.subscribe(['a'], vi.fn(), vi.fn())).rejects.toThrow('refused');
    expect(connection().unsubscribe).toHaveBeenCalledWith('a');
    await pubSub.subscribe(['a'], vi.fn(), vi.fn());
    expect(connection().subscribe).toHaveBeenCalledTimes(3);
  });

  /**
   * Nothing published while the connection was down reached this replica. A
   * stream left open on it would read live and hear nothing.
   */
  it('tells every subscription once when its connection closes, and keeps none of its channels', async () => {
    const { pubSub, connection } = setup();
    const lostA = vi.fn();
    const lostB = vi.fn();
    const heard = vi.fn();
    await pubSub.subscribe(['a', 'b'], heard, lostA);
    await pubSub.subscribe(['a'], vi.fn(), lostB);

    connection().emit('close');
    connection().emit('message', 'a', '{"n":1}');

    expect(lostA).toHaveBeenCalledTimes(1);
    expect(lostB).toHaveBeenCalledTimes(1);
    expect(heard).not.toHaveBeenCalled();
  });

  /** Once ioredis gives up, that connection never comes back; a stream on it would wait forever. */
  it('opens a new connection for the next stream once the old one has ended', async () => {
    const { pubSub, connection } = setup();
    await pubSub.subscribe(['a'], vi.fn(), vi.fn());
    const ended = connection();

    ended.emit('close');
    ended.emit('end');
    await pubSub.subscribe(['a'], vi.fn(), vi.fn());

    expect(connection()).not.toBe(ended);
    expect(connection().subscribe).toHaveBeenCalledWith('a');
  });

  it('closes its connection on shutdown', async () => {
    const { pubSub, connection } = setup();
    await pubSub.subscribe(['a'], vi.fn(), vi.fn());
    await pubSub.onApplicationShutdown();
    expect(connection().quit).toHaveBeenCalledTimes(1);
  });
});
