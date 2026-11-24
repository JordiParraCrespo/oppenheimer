import { ServerEventStream, type ServerEventStreamStatus } from '@oppenheimer/frontend-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventSourceFactory } from '../lib/event-source';

/** The app's foreground state, as far as the adapter listens to it. */
const appState = vi.hoisted(() => {
  const listeners = new Set<(state: string) => void>();
  return {
    listeners,
    addEventListener(_type: 'change', listener: (state: string) => void) {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
    become(state: string) {
      for (const listener of listeners) listener(state);
    },
  };
});

vi.mock('react-native', () => ({ AppState: appState }));

/**
 * React Native's `XMLHttpRequest` as far as `react-native-sse` drives it: the
 * real library runs on top, so its redial rules are the ones under test.
 */
class FakeXhr {
  static readonly LOADING = 3;
  static readonly DONE = 4;
  static dials: FakeXhr[] = [];

  readyState = 0;
  status = 0;
  responseText = '';
  aborted = false;
  timeout = 0;
  readonly headers: Record<string, string> = {};
  onreadystatechange: (() => void) | null = null;
  onerror: (() => void) | null = null;

  open() {}
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send() {
    FakeXhr.dials.push(this);
  }
  abort() {
    this.aborted = true;
  }

  /** The server answers and streams these frames. */
  stream(status: number, frames: string) {
    this.status = status;
    this.readyState = FakeXhr.LOADING;
    this.responseText += frames;
    this.onreadystatechange?.();
  }
  /** The response finished: the stream ended, or an error status completed. */
  finish() {
    this.readyState = FakeXhr.DONE;
    this.onreadystatechange?.();
  }
  /** The request failed with no answer: the server unreachable, the network gone. */
  fail() {
    this.readyState = FakeXhr.DONE;
    this.status = 0;
    this.onreadystatechange?.();
    this.onerror?.();
  }
}

const READY = 'event: ready\ndata: {}\n\n';

/**
 * The phone's change feed behaves as the browser's: a refused stream (a
 * signed-out cookie) stays closed rather than redialling every few seconds
 * forever, a dropped one reads as down and is redialled until the server
 * answers, however long the outage, and each dial carries the cookie the app
 * holds at that moment; a drop that waits to redial redials at once when the
 * app comes back to the foreground. What breaks if this drifts: a phone that hammers the
 * API with a dead cookie, a feed that never comes back after the API was down
 * for longer than one redial, one that redials with a cookie rotated away, or
 * one that sits down for a redial interval after the phone is unlocked.
 */
describe('the React Native event source', () => {
  let statuses: ServerEventStreamStatus[];
  let events: unknown[];
  let cookie: string;
  let stream: ServerEventStream<unknown>;
  const latest = () => FakeXhr.dials.at(-1) as FakeXhr;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    FakeXhr.dials = [];
    statuses = [];
    events = [];
    cookie = 'session=abc';
    stream = new ServerEventStream<unknown>({
      url: 'https://api.test/api/v1/events',
      readyEvent: 'ready',
      eventName: 'change',
      read: (data) => data,
      sourceFactory: createEventSourceFactory(() => ({ Cookie: cookie })),
    });
    stream.onStatus((status) => statuses.push(status));
    stream.onEvent((event) => events.push(event));
    stream.open();
    vi.advanceTimersByTime(500);
  });

  afterEach(() => {
    stream.dispose();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('dials with the session cookie and passes frames through once ready', () => {
    expect(latest().headers.Cookie).toBe('session=abc');
    latest().stream(200, `${READY}event: change\ndata: {"type":"session.changed","id":"s1"}\n\n`);
    expect(statuses.at(-1)).toBe('live');
    expect(events).toEqual([{ type: 'session.changed', id: 's1' }]);
  });

  it('stays closed after a refusal, and the library never redials it', async () => {
    latest().stream(401, '');
    latest().finish();
    await Promise.resolve();
    vi.advanceTimersByTime(60_000);
    expect(statuses.at(-1)).toBe('closed');
    expect(FakeXhr.dials).toHaveLength(1);
  });

  it('redials through an outage of any length until the server answers', () => {
    latest().stream(200, READY);
    latest().fail();
    expect(statuses.at(-1)).toBe('down');
    // Each redial in the outage meets no server: the library alone stops here.
    for (let attempt = 0; attempt < 6; attempt++) {
      const before = FakeXhr.dials.length;
      vi.advanceTimersByTime(5000);
      expect(FakeXhr.dials).toHaveLength(before + 1);
      latest().fail();
    }
    vi.advanceTimersByTime(5000);
    latest().stream(200, READY);
    expect(statuses.at(-1)).toBe('live');
  });

  it('reads a stream the server ended as down while it redials, and live again once ready', () => {
    latest().stream(200, READY);
    latest().finish();
    vi.advanceTimersByTime(5000);
    expect(FakeXhr.dials).toHaveLength(2);
    expect(statuses.at(-1)).toBe('down');
    latest().stream(200, READY);
    expect(statuses.at(-1)).toBe('live');
  });

  it('redials with the cookie the app holds now, not the one it first dialled with', () => {
    latest().stream(200, READY);
    cookie = 'session=rotated';
    latest().fail();
    vi.advanceTimersByTime(5000);
    expect(latest().headers.Cookie).toBe('session=rotated');

    // The library's own redial, after an error status, reads it afresh too.
    cookie = 'session=again';
    latest().stream(503, '');
    latest().finish();
    vi.advanceTimersByTime(5000);
    expect(latest().headers.Cookie).toBe('session=again');
  });

  it('redials a connection dropped in the background the moment the app is back', () => {
    latest().stream(200, READY);
    latest().fail();
    appState.become('active');
    vi.advanceTimersByTime(0);
    expect(FakeXhr.dials).toHaveLength(2);
    latest().stream(200, READY);
    expect(statuses.at(-1)).toBe('live');
  });

  it('leaves a live stream alone when the app comes back', () => {
    latest().stream(200, READY);
    appState.become('active');
    vi.advanceTimersByTime(60_000);
    expect(FakeXhr.dials).toHaveLength(1);
  });

  it('stops listening for the foreground once disposed', () => {
    stream.dispose();
    expect(appState.listeners.size).toBe(0);
  });

  it('stops redialling once the stream is disposed', () => {
    latest().fail();
    stream.dispose();
    vi.advanceTimersByTime(60_000);
    expect(FakeXhr.dials).toHaveLength(1);
  });
});
