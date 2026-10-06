import { LIVE_EVENT_NAME, type LiveEvent, liveEventSchema } from '@oppenheimer/shared/live';
import { inject, injectable, optional } from 'inversify';
import { CONSUMER_CONFIG } from '../../config';
import { TOKENS } from '../../di/tokens';

/**
 * `live` is a stream the API answered and is speaking; `connecting` is a dial,
 * first or after a drop; `down` is a stream the API refused, waiting to dial
 * again. Only `live` lets a poll stop.
 */
export type LiveStatus = 'off' | 'connecting' | 'live' | 'down';

/** The slice of `EventSource` this service drives, so a test can hand it a fake. */
export interface LiveSource {
  readonly readyState: number;
  addEventListener(type: string, listener: (event: MessageEvent) => void): void;
  close(): void;
}

export type LiveSourceFactory = (url: string) => LiveSource;

/** `EventSource.CLOSED`: the browser gave up on this source and will not dial it again. */
const CLOSED = 2;

const LIVE_PATH = '/api/v1/live';

/**
 * The console's one live stream (`GET /v1/live`): which of the workspace's
 * rows changed, as the API hears it. One per app, whoever listens.
 *
 * The browser's `EventSource` dials again by itself after a stream ends, which
 * the API does every few minutes on purpose. When the API refuses a dial
 * instead — signed out, the flag off, its bus unreachable — the source is
 * closed for good, and this dials again after a wait.
 */
@injectable()
export class LiveService {
  private source: LiveSource | null = null;
  private redial: ReturnType<typeof setTimeout> | undefined;
  private current: LiveStatus = 'off';
  private readonly statusListeners = new Set<(status: LiveStatus) => void>();
  private readonly eventListeners = new Set<(event: LiveEvent) => void>();
  private readonly createSource: LiveSourceFactory;

  constructor(
    /** Empty for a console served beside the API, which then dials its own origin. */
    @inject(TOKENS.ApiBaseUrl)
    private readonly apiBaseUrl: string,
    @inject(TOKENS.LiveSourceFactory)
    @optional()
    createSource?: LiveSourceFactory,
  ) {
    this.createSource = createSource ?? ((url) => new EventSource(url, { withCredentials: true }));
  }

  status(): LiveStatus {
    return this.current;
  }

  onStatus(listener: (status: LiveStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onEvent(listener: (event: LiveEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /** Open the stream; does nothing while one is already open or dialling. */
  start(): void {
    if (this.source || this.redial !== undefined) return;
    this.dial();
  }

  stop(): void {
    clearTimeout(this.redial);
    this.redial = undefined;
    this.source?.close();
    this.source = null;
    this.setStatus('off');
  }

  private dial(): void {
    this.redial = undefined;
    const source = this.createSource(`${this.apiBaseUrl.replace(/\/$/, '')}${LIVE_PATH}`);
    this.source = source;
    this.setStatus('connecting');
    source.addEventListener('open', () => this.setStatus('live'));
    source.addEventListener(LIVE_EVENT_NAME, (message) => this.deliver(message.data));
    source.addEventListener('error', () => {
      if (source !== this.source) return;
      if (source.readyState !== CLOSED) {
        // The browser is dialling again by itself.
        this.setStatus('connecting');
        return;
      }
      source.close();
      this.source = null;
      this.setStatus('down');
      this.redial = setTimeout(() => this.dial(), CONSUMER_CONFIG.live.redialAfterRefusalMs);
    });
  }

  private deliver(data: string): void {
    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      return;
    }
    const parsed = liveEventSchema.safeParse(payload);
    if (!parsed.success) return;
    for (const listener of this.eventListeners) listener(parsed.data);
  }

  private setStatus(status: LiveStatus): void {
    if (status === this.current) return;
    this.current = status;
    for (const listener of this.statusListeners) listener(status);
  }
}
