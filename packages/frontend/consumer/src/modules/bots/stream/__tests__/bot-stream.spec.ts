import { describe, expect, it, vi } from 'vitest';
import type { EventSourceLike } from '../../../organizations/events/workspace-event-stream';
import { BotStream, type BotStreamStatus } from '../bot-stream';

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
  const stream = new BotStream({
    apiBaseUrl: 'https://api.example',
    botId: 'bot-1',
    sourceFactory: (url) => {
      const source = new FakeSource(url);
      sources.push(source);
      return source;
    },
  });
  const statuses: BotStreamStatus[] = [];
  stream.onStatus((status) => statuses.push(status));
  const events = vi.fn();
  stream.onEvent(events);
  return { stream, sources, statuses, events };
}

describe('BotStream', () => {
  it("dials the bot's stream under the API's /api prefix, and only when opened", () => {
    const { stream, sources } = setup();
    expect(sources).toHaveLength(0);
    stream.open();
    expect(sources[0]?.url).toBe('https://api.example/api/v1/bots/bot-1/stream');
  });

  it('is live from the ready frame, and down while the browser redials', () => {
    const { stream, sources, statuses } = setup();
    stream.open();
    sources[0]?.emit('ready');
    sources[0]?.fail(0);
    expect(statuses).toEqual(['down', 'live', 'down']);
  });

  /** A refused stream (a 401, a bot gone) is not redialled, by the browser or by this. */
  it('closes for good once the browser gives up', () => {
    const { stream, sources, statuses } = setup();
    stream.open();
    sources[0]?.fail(2);
    stream.open();
    expect(statuses.at(-1)).toBe('closed');
    expect(sources).toHaveLength(1);
  });

  it('hands on the events it can read, and drops the rest', () => {
    const { stream, sources, events } = setup();
    stream.open();
    const source = sources[0] as FakeSource;
    source.emit(
      'bot',
      JSON.stringify({ type: 'text', turnId: 't1', block: 0, seq: 1, text: 'Hel' }),
    );
    source.emit(
      'bot',
      JSON.stringify({ type: 'snapshot', turnId: 't1', block: 0, seq: 1, text: 'Hel' }),
    );
    source.emit('bot', JSON.stringify({ type: 'turn', turnId: 't1', status: 'completed' }));
    source.emit('bot', JSON.stringify({ type: 'message', turnId: 't1', messageId: 'm1' }));
    source.emit('bot', '{not json');
    source.emit('bot', JSON.stringify({ type: 'turn', turnId: 't1', status: 'exploded' }));
    source.emit('bot', JSON.stringify({ type: 'text', turnId: 't1' }));
    source.emit('bot', JSON.stringify({ type: 'other', turnId: 't1' }));
    expect(events.mock.calls.map(([event]) => event.type)).toEqual([
      'text',
      'snapshot',
      'turn',
      'message',
    ]);
  });

  it('stops listening once disposed', () => {
    const { stream, sources, events } = setup();
    stream.open();
    stream.dispose();
    sources[0]?.emit('bot', JSON.stringify({ type: 'text', turnId: 't1', text: 'x' }));
    expect(sources[0]?.closed).toBe(true);
    expect(events).not.toHaveBeenCalled();
  });
});
