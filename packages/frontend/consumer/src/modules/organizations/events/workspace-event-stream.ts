import {
  isWorkspaceEvent,
  WORKSPACE_STREAM_EVENT,
  WORKSPACE_STREAM_READY,
  type WorkspaceEvent,
} from '@oppenheimer/shared/workspace-events';

/**
 * `live` from the API's `ready` frame; `down` before it and while the browser
 * redials a dropped connection; `closed` once the API refused the stream (a
 * 401, the flag off, nothing the caller may read), which the browser never
 * retries and neither does this.
 */
export type WorkspaceStreamStatus = 'down' | 'live' | 'closed';

/** The part of `EventSource` the stream uses, so a test can hand it a fake. */
export interface EventSourceLike {
  readonly readyState: number;
  onerror: ((event: Event) => void) | null;
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void;
  close(): void;
}

export interface WorkspaceEventStreamOptions {
  apiBaseUrl: string;
  /** Injected in tests; `EventSource` with credentials otherwise. */
  sourceFactory?: (url: string) => EventSourceLike;
}

/** `EventSource.CLOSED`, without reading a global a non-browser test may not have. */
const CLOSED = 2;

/**
 * The workspace's change feed (`GET /api/v1/events`): one Server-Sent Events
 * connection per console tab, carrying invalidations, never rows.
 *
 * The browser's `EventSource` redials a dropped connection on its own, and
 * gives up for good on an answer that is not a stream. So does this: a
 * refused stream stays closed, and the console's polls carry on as they
 * would without it.
 *
 * Nothing is opened until `open()`; `dispose()` closes it for good.
 */
export class WorkspaceEventStream {
  private readonly eventListeners = new Set<(event: WorkspaceEvent) => void>();
  private readonly statusListeners = new Set<(status: WorkspaceStreamStatus) => void>();
  private readonly sourceFactory: (url: string) => EventSourceLike;

  private source: EventSourceLike | null = null;
  private status: WorkspaceStreamStatus = 'down';

  constructor(private readonly options: WorkspaceEventStreamOptions) {
    this.sourceFactory =
      options.sourceFactory ?? ((url) => new EventSource(url, { withCredentials: true }));
  }

  onEvent(listener: (event: WorkspaceEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /** The current status first, then each change. */
  onStatus(listener: (status: WorkspaceStreamStatus) => void): () => void {
    listener(this.status);
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  open(): void {
    if (this.source || this.status === 'closed') return;
    const source = this.sourceFactory(`${this.options.apiBaseUrl}/api/v1/events`);
    this.source = source;

    source.addEventListener(WORKSPACE_STREAM_READY, () => {
      if (this.source === source) this.setStatus('live');
    });
    source.addEventListener(WORKSPACE_STREAM_EVENT, (message) => {
      if (this.source !== source) return;
      let event: unknown;
      try {
        event = JSON.parse(message.data);
      } catch {
        return;
      }
      if (!isWorkspaceEvent(event)) return;
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

  private setStatus(next: WorkspaceStreamStatus): void {
    if (this.status === next) return;
    this.status = next;
    for (const listener of this.statusListeners) listener(next);
  }
}
