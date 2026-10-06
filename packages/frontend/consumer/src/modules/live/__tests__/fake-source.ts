import type { LiveSource } from '../live.service';

/** An `EventSource` the spec drives: it opens, speaks and fails when told to. */
class FakeSource implements LiveSource {
  readyState = 0;
  private readonly listeners = new Map<string, ((event: MessageEvent<string>) => void)[]>();

  constructor(readonly url: string) {}

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close(): void {
    this.readyState = 2;
  }

  open(): void {
    this.readyState = 1;
    this.emit('open');
  }

  say(data: unknown): void {
    this.emit('live', typeof data === 'string' ? data : JSON.stringify(data));
  }

  /** The browser lost the stream and is dialling it again by itself. */
  drop(): void {
    this.readyState = 0;
    this.emit('error');
  }

  /** The API refused the dial: the browser will not try this source again. */
  refuse(): void {
    this.readyState = 2;
    this.emit('error');
  }

  private emit(type: string, data = ''): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data } as MessageEvent<string>);
    }
  }
}

export function fakeSources() {
  const opened: FakeSource[] = [];
  return {
    opened,
    factory: (url: string) => {
      const source = new FakeSource(url);
      opened.push(source);
      return source;
    },
    latest: () => opened.at(-1) as FakeSource,
  };
}
