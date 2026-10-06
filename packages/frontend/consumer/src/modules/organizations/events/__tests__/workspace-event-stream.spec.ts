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

function setup(apiBaseUrl = '') {
  const sources: FakeSource[] = [];
  const stream = new WorkspaceEventStream({
    apiBaseUrl,
    sourceFactory: (url) => {
      const source = new FakeSource(url);
      sources.push(source);
      return source;
    },
  });
  const statuses: WorkspaceStreamStatus[] = [];
  stream.onStatus((status) => statuses.push(status));
  const events = vi.fn();
  stream.onEvent(events);
  return { stream, sources, statuses, events };
}

describe('WorkspaceEventStream', () => {
  /**
   * The regression: the path was `/v1/events`, which the SPA served in place
   * of the API, so the stream never once said `ready`.
   */
  it('dials the API under its /api prefix, and only when opened', () => {
    const same = setup();
    expect(same.sources).toHaveLength(0);
    same.stream.open();
    expect(same.sources.map((source) => source.url)).toEqual(['/api/v1/events']);

    const cross = setup('https://api.example.com');
    cross.stream.open();
    expect(cross.sources[0].url).toBe('https://api.example.com/api/v1/events');
  });

  it('is live from the ready frame and delivers each change it knows', () => {
    const { stream, sources, statuses, events } = setup();
    stream.open();
    sources[0].emit('ready');
    sources[0].emit('change', JSON.stringify({ type: 'host.changed', id: 'h-1' }));
    sources[0].emit('change', '{not json');
    sources[0].emit('change', JSON.stringify({ type: 'invoice.paid', id: 'x' }));

    expect(statuses).toEqual(['down', 'live']);
    expect(events).toHaveBeenCalledTimes(1);
    expect(events).toHaveBeenCalledWith({ type: 'host.changed', id: 'h-1' });
  });

  it('goes down on a drop and is live again once the browser has redialled', () => {
    const { stream, sources, statuses } = setup();
    stream.open();
    sources[0].emit('ready');
    sources[0].fail(0);
    sources[0].emit('ready');
    expect(statuses).toEqual(['down', 'live', 'down', 'live']);
    expect(sources).toHaveLength(1);
  });

  /** A 401, the flag off, nothing the caller may read: the browser gives up, and so does this. */
  it('stays closed once the API refused the stream', () => {
    const { stream, sources, statuses } = setup();
    stream.open();
    sources[0].fail(2);
    stream.open();
    expect(statuses.at(-1)).toBe('closed');
    expect(sources).toHaveLength(1);
  });

  it('closes for good on dispose', () => {
    const { stream, sources, statuses } = setup();
    stream.open();
    sources[0].emit('ready');
    stream.dispose();
    expect(sources[0].closed).toBe(true);
    expect(statuses.at(-1)).toBe('closed');
  });
});
