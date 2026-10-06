import {
  isWorkspaceEvent,
  WORKSPACE_STREAM_EVENT,
  WORKSPACE_STREAM_READY,
  type WorkspaceEvent,
} from '@oppenheimer/shared/workspace-events';
import { CONSUMER_CONFIG } from '../../../config';

/**
 * `live` from the stream's `ready` frame until it drops; `down` before that
 * and after. Only `live` lets a poll stand down: an event published while the
 * stream was down was never delivered.
 */
export type WorkspaceStreamStatus = 'down' | 'live';

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
  /** Injected in tests; `setTimeout` otherwise. Returns its own cancel. */
  schedule?: (fn: () => void, ms: number) => () => void;
}

/** `EventSource.CLOSED`, without reading a global a non-browser test may not have. */
const CLOSED = 2;

/**
 * The workspace's change feed (`GET /v1/events`): one Server-Sent Events
 * connection per console tab, carrying invalidations, never rows.
 *
 * The browser's `EventSource` reconnects on its own after a network drop. It
 * gives up for good on an HTTP answer that is not a stream (a 401 once the
 * session expired, a 404 while the flag is off at the API), and then this
 * dials again on the terminal's ladder, so a deploy or an expired cookie
 * that the console renews recovers without a reload.
 *
 * Constructing one dials; `dispose()` closes it for good.
 */
export class WorkspaceEventStream {
  private readonly eventListeners = new Set<(event: WorkspaceEvent) => void>();
  private readonly statusListeners = new Set<(status: WorkspaceStreamStatus) => void>();
  private readonly sourceFactory: (url: string) => EventSourceLike;
  private readonly schedule: (fn: () => void, ms: number) => () => void;

  private source: EventSourceLike | null = null;
  private status: WorkspaceStreamStatus = 'down';
  private disposed = false;
  private attempt = 0;
  private cancelRetry: (() => void) | null = null;

  constructor(private readonly options: WorkspaceEventStreamOptions) {
    this.sourceFactory =
      options.sourceFactory ?? ((url) => new EventSource(url, { withCredentials: true }));
    this.schedule =
      options.schedule ??
      ((fn, ms) => {
        const timer = setTimeout(fn, ms);
        return () => clearTimeout(timer);
      });
    this.connect();
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

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelRetry?.();
    this.source?.close();
    this.source = null;
    this.setStatus('down');
    this.eventListeners.clear();
    this.statusListeners.clear();
  }

  private connect(): void {
    if (this.disposed) return;
    const source = this.sourceFactory(`${this.options.apiBaseUrl}/v1/events`);
    this.source = source;

    source.addEventListener(WORKSPACE_STREAM_READY, () => {
      if (this.source !== source) return;
      this.attempt = 0;
      this.setStatus('live');
    });
    source.addEventListener(WORKSPACE_STREAM_EVENT, (message) => {
      if (this.source !== source || this.status !== 'live') return;
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
      // Either way the stream missed whatever happened until the next `ready`.
      this.setStatus('down');
      if (source.readyState !== CLOSED) return; // the browser is already retrying
      source.close();
      this.source = null;
      this.retry();
    };
  }

  private retry(): void {
    const ladder = CONSUMER_CONFIG.events.reconnectLadderMs;
    const base = ladder[Math.min(this.attempt, ladder.length - 1)];
    this.attempt += 1;
    const jitter = base * (Math.random() * 0.4 - 0.2);
    this.cancelRetry = this.schedule(
      () => {
        this.cancelRetry = null;
        this.connect();
      },
      Math.max(0, Math.round(base + jitter)),
    );
  }

  private setStatus(next: WorkspaceStreamStatus): void {
    if (this.status === next) return;
    this.status = next;
    for (const listener of this.statusListeners) listener(next);
  }
}
