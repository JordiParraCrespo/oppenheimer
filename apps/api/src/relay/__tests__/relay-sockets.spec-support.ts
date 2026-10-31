import type { WebSocket } from 'ws';

/*
 * Waiting on events instead of the clock, for the relay's socket specs: a
 * lookup the test releases, a round trip that proves the server read what was
 * sent, and one turn of the event loop.
 */

export interface Held<T> {
  /** The stand-in for a port method: it answers `value` once released. */
  answer: () => Promise<T>;
  /** Resolves when `answer` is first called: the relay is waiting on it. */
  entered: Promise<void>;
  release: () => void;
}

/**
 * A lookup that answers only when the test says so, so a frame can land while
 * a ticket is judged without racing a clock.
 */
export function held<T>(value: T): Held<T> {
  let release!: () => void;
  let enter!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const entered = new Promise<void>((resolve) => {
    enter = resolve;
  });
  return {
    answer: async () => {
      enter();
      await gate;
      return value;
    },
    entered,
    release,
  };
}

/**
 * Resolves once the server has read every frame sent before it: a peer answers
 * a ping in order with the frames ahead of it (RFC 6455 §5.5.2).
 */
export function readByServer(socket: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    socket.once('pong', () => resolve());
    socket.ping();
  });
}

/** Lets the relay run what it has queued: the microtasks, then one turn of the event loop. */
export function settled(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
