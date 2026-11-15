import { ServerEventStream, type ServerEventStreamStatus } from '@oppenheimer/frontend-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (event: Record<string, unknown>) => void;

/** `react-native-sse` as far as the adapter drives it: listeners, a close, the headers it was dialled with. */
class FakeSource {
  static last: FakeSource;
  readonly listeners = new Map<string, Listener[]>();
  closed = false;
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
  close() {
    this.closed = true;
  }
}

vi.mock('react-native-sse', () => ({ default: FakeSource }));

const { createEventSourceFactory } = await import('../lib/event-source');

/**
 * The phone's change feed behaves as the browser's: a refused stream (a
 * signed-out cookie) stays closed rather than redialling every few seconds
 * forever, a dropped one reads as down while it redials, and the frames reach
 * the stream. What breaks if this drifts: a phone that hammers the API with a
 * dead cookie, or a list whose polls stand down on a stream that is not live.
 */
describe('the React Native event source', () => {
  let statuses: ServerEventStreamStatus[];
  let events: unknown[];

  beforeEach(() => {
    statuses = [];
    events = [];
    const stream = new ServerEventStream<unknown>({
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

  it('reads a dropped connection as down and leaves the redial to the library', async () => {
    FakeSource.last.dispatch('ready', { data: '{}' });
    FakeSource.last.dispatch('error', { xhrStatus: 0 });
    await Promise.resolve();
    expect(statuses.at(-1)).toBe('down');
    expect(FakeSource.last.closed).toBe(false);
  });
});
