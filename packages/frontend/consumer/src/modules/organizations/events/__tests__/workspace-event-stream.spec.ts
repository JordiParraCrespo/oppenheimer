import { describe, expect, it, vi } from 'vitest';
import {
  type EventSourceLike,
  WorkspaceEventStream,
  type WorkspaceStreamStatus,
} from '../workspace-event-stream';

class FakeSource implements EventSourceLike {
  readyState = 0;
  onerror: ((event: Event) => void) | null = null;
  closed = false;
  private readonly listeners = new Map<string, ((event: MessageEvent<string>) => void)[]>();

  constructor(readonly url: string) {}

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close(): void {
    this.closed = true;
    this.readyState = 2;
  }

  emit(type: string, data = ''): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data } as MessageEvent<string>);
    }
  }

  fail(readyState: 0 | 2): void {
    this.readyState = readyState;
    this.onerror?.(new Event('error'));
  }
}

function setup() {
  const sources: FakeSource[] = [];
  const timers: (() => void)[] = [];
  const stream = new WorkspaceEventStream({
    apiBaseUrl: 'https://api.test',
    sourceFactory: (url) => {
      const source = new FakeSource(url);
      sources.push(source);
      return source;
    },
    schedule: (fn) => {
      timers.push(fn);
      return () => timers.splice(timers.indexOf(fn), 1);
    },
  });
  const statuses: WorkspaceStreamStatus[] = [];
  stream.onStatus((status) => statuses.push(status));
  const events = vi.fn();
  stream.onEvent(events);
  return { stream, sources, timers, statuses, events };
}

describe('WorkspaceEventStream', () => {
  it('dials the API on construction', () => {
    const { sources } = setup();
    expect(sources.map((source) => source.url)).toEqual(['https://api.test/v1/events']);
  });

  /**
   * The regression: a stream that counted as live from the moment it dialled
   * would stand the polls down before the API had subscribed it, and an event
   * in that gap would be lost with nothing left asking.
   */
  it('is live only from the ready frame, and delivers changes only then', () => {
    const { sources, statuses, events } = setup();
    const change = JSON.stringify({ type: 'host.changed', id: 'h-1' });

    sources[0].emit('change', change);
    expect(statuses).toEqual(['down']);
    expect(events).not.toHaveBeenCalled();

    sources[0].emit('ready');
    sources[0].emit('change', change);
    expect(statuses).toEqual(['down', 'live']);
    expect(events).toHaveBeenCalledWith({ type: 'host.changed', id: 'h-1' });
  });

  it('drops a frame that is not one of the events it knows', () => {
    const { sources, events } = setup();
    sources[0].emit('ready');
    sources[0].emit('change', '{not json');
    sources[0].emit('change', JSON.stringify({ type: 'invoice.paid', id: 'x' }));
    expect(events).not.toHaveBeenCalled();
  });

  it('goes down on a drop and leaves the redial to the browser', () => {
    const { sources, timers, statuses } = setup();
    sources[0].emit('ready');
    sources[0].fail(0);
    expect(statuses.at(-1)).toBe('down');
    expect(timers).toHaveLength(0);
    sources[0].emit('ready');
    expect(statuses.at(-1)).toBe('live');
  });

  /** An expired cookie or a deploy is a refused stream, which the browser never retries. */
  it('dials again on its own ladder once the API refused the stream', () => {
    const { sources, timers } = setup();
    sources[0].fail(2);
    expect(sources[0].closed).toBe(true);
    expect(timers).toHaveLength(1);
    timers[0]();
    expect(sources).toHaveLength(2);
  });

  it('closes for good on dispose', () => {
    const { stream, sources, timers, statuses } = setup();
    sources[0].emit('ready');
    stream.dispose();
    expect(sources[0].closed).toBe(true);
    expect(statuses.at(-1)).toBe('down');
    sources[0].fail(2);
    expect(timers).toHaveLength(0);
  });
});
