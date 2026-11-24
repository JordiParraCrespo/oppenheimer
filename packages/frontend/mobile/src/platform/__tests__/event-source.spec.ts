import { ServerEventStream, type ServerEventStreamStatus } from '@oppenheimer/frontend-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (event: Record<string, unknown>) => void;

/** `react-native-sse` as far as the adapter drives it: listeners, a close, the headers it was dialled with. */
class FakeSource {
  static last: FakeSource;
  readonly listeners = new Map<string, Listener[]>();
  closed = false;
  dials = 1;
  constructor(
    readonly url: string,
    readonly options: { headers: Record<string, string> },
  ) {
    FakeSource.last = this;
  }
  addEventListener(type: string, listener: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  dispatch(type: string, event: Record<string, unknown>) {
    for (const listener of this.listeners.get(type) ?? []) listener({ type, ...event });
  }
  open() {
    this.dials += 1;
  }
  close() {
    this.closed = true;
  }
}

/** The app's foreground state, as far as the adapter listens to it. */
const appState = {
  listeners: new Set<(state: string) => void>(),
  addEventListener(_type: 'change', listener: (state: string) => void) {
    appState.listeners.add(listener);
    return { remove: () => appState.listeners.delete(listener) };
  },
  become(state: string) {
    for (const listener of appState.listeners) listener(state);
  },
};

vi.mock('react-native-sse', () => ({ default: FakeSource }));
vi.mock('react-native', () => ({ AppState: appState }));

const { createEventSourceFactory } = await import('../lib/event-source');

/**
 * The phone's change feed behaves as the browser's: a refused stream (a
 * signed-out cookie) stays closed rather than redialling every few seconds
 * forever, a dropped one reads as down while it redials (at once when the app
 * is back in the foreground), and the frames reach the stream. What breaks if
 * this drifts: a phone that hammers the API with a dead cookie, a list whose
 * polls stand down on a stream that is not live, or a bot's chat that stops
 * hearing its turns for good after the phone was locked.
 */
describe('the React Native event source', () => {
  let statuses: ServerEventStreamStatus[];
  let events: unknown[];

  let stream: ServerEventStream<unknown>;

  beforeEach(() => {
    vi.useFakeTimers();
    statuses = [];
    events = [];
    stream = new ServerEventStream<unknown>({
      url: 'https://api.test/api/v1/events',
      readyEvent: 'ready',
      eventName: 'change',
      read: (data) => data,
      sourceFactory: createEventSourceFactory(() => ({ Cookie: 'session=abc' })),
    });
    stream.onStatus((status) => statuses.push(status));
    stream.onEvent((event) => events.push(event));
    stream.open();
  });

  afterEach(() => {
    stream.dispose();
    vi.useRealTimers();
  });

  it('dials with the session cookie and passes frames through once ready', () => {
    expect(FakeSource.last.options.headers).toEqual({ Cookie: 'session=abc' });
    FakeSource.last.dispatch('ready', { data: '{}' });
    FakeSource.last.dispatch('change', { data: '{"type":"session.changed","id":"s1"}' });
    expect(statuses.at(-1)).toBe('live');
    expect(events).toEqual([{ type: 'session.changed', id: 's1' }]);
  });

  it('stays closed after a refusal, and closes the library so it does not redial', async () => {
    FakeSource.last.dispatch('error', { xhrStatus: 401 });
    expect(statuses.at(-1)).toBe('closed');
    await Promise.resolve();
    expect(FakeSource.last.closed).toBe(true);
  });

  it('reads a dropped connection as down and redials it, which the library never does', async () => {
    FakeSource.last.dispatch('ready', { data: '{}' });
    FakeSource.last.dispatch('error', { xhrStatus: 0 });
    await Promise.resolve();
    expect(statuses.at(-1)).toBe('down');
    expect(FakeSource.last.closed).toBe(false);
    vi.advanceTimersByTime(3000);
    expect(FakeSource.last.dials).toBe(2);
    FakeSource.last.dispatch('ready', { data: '{}' });
    expect(statuses.at(-1)).toBe('live');
  });

  it('redials a connection dropped in the background the moment the app is back', () => {
    FakeSource.last.dispatch('ready', { data: '{}' });
    FakeSource.last.dispatch('error', { xhrStatus: 0 });
    appState.become('active');
    vi.advanceTimersByTime(0);
    expect(FakeSource.last.dials).toBe(2);
    vi.advanceTimersByTime(3000);
    expect(FakeSource.last.dials).toBe(2);
  });

  it('leaves a live stream alone when the app comes back, and a 5xx to the library', () => {
    FakeSource.last.dispatch('ready', { data: '{}' });
    appState.become('active');
    FakeSource.last.dispatch('error', { xhrStatus: 503 });
    appState.become('active');
    vi.advanceTimersByTime(10_000);
    expect(FakeSource.last.dials).toBe(1);
  });

  it('stops listening for the foreground once disposed', () => {
    stream.dispose();
    expect(appState.listeners.size).toBe(0);
  });
});
