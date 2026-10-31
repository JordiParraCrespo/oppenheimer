/**
 * `live` from the server's `ready` frame; `down` before it and while the
 * browser redials a dropped connection; `closed` once the server refused the
 * stream (a 401, a flag off, nothing the caller may read), which the browser
 * never retries and neither does this.
 */
export type ServerEventStreamStatus = 'down' | 'live' | 'closed';

/** The part of `EventSource` a stream uses, so a test can hand it a fake. */
export interface EventSourceLike {
  readonly readyState: number;
  onerror: ((event: Event) => void) | null;
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void;
  close(): void;
}

export interface ServerEventStreamOptions<TEvent> {
  url: string;
  /** The frame that says the server is subscribed. */
  readyEvent: string;
  /** The frame that carries an event. */
  eventName: string;
  /**
   * The event a frame's JSON carries, or null for one this build cannot read:
   * it crossed the network, and an unreadable frame is dropped.
   */
  read: (data: unknown) => TEvent | null;
  /** Injected in tests; `EventSource` with credentials otherwise. */
  sourceFactory?: (url: string) => EventSourceLike;
}

/** `EventSource.CLOSED`, without reading a global a non-browser test may not have. */
const CLOSED = 2;

/**
 * One Server-Sent Events connection: its events to whoever listens, and its
 * status. The browser's `EventSource` redials a dropped connection on its
 * own and gives up for good on an answer that is not a stream; so does this,
 * and a refused stream stays closed. Nothing is opened until `open()`, so a
 * caller subscribes first and misses no frame; `dispose()` closes it for good.
 */
export class ServerEventStream<TEvent> {
  private readonly eventListeners = new Set<(event: TEvent) => void>();
  private readonly statusListeners = new Set<(status: ServerEventStreamStatus) => void>();
  private readonly sourceFactory: (url: string) => EventSourceLike;

  private source: EventSourceLike | null = null;
  private status: ServerEventStreamStatus = 'down';

  constructor(private readonly options: ServerEventStreamOptions<TEvent>) {
    this.sourceFactory =
      options.sourceFactory ?? ((url) => new EventSource(url, { withCredentials: true }));
  }

  onEvent(listener: (event: TEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /** The current status first, then each change. */
  onStatus(listener: (status: ServerEventStreamStatus) => void): () => void {
    listener(this.status);
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  open(): void {
    if (this.source || this.status === 'closed') return;
    const source = this.sourceFactory(this.options.url);
    this.source = source;

    source.addEventListener(this.options.readyEvent, () => {
      if (this.source === source) this.setStatus('live');
    });
    source.addEventListener(this.options.eventName, (message) => {
      if (this.source !== source) return;
      let data: unknown;
      try {
        data = JSON.parse(message.data);
      } catch {
        return;
      }
      const event = this.options.read(data);
      if (event === null) return;
      for (const listener of this.eventListeners) listener(event);
    });
    source.onerror = () => {
      if (this.source !== source) return;
      if (source.readyState !== CLOSED) {
        this.setStatus('down');
        return;
      }
      this.close();
    };
  }

  dispose(): void {
    this.close();
    this.eventListeners.clear();
    this.statusListeners.clear();
  }

  private close(): void {
    this.source?.close();
    this.source = null;
    this.setStatus('closed');
  }

  private setStatus(next: ServerEventStreamStatus): void {
    if (this.status === next) return;
    this.status = next;
    for (const listener of this.statusListeners) listener(next);
  }
}
