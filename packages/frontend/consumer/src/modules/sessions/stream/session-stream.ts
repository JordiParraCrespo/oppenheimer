import {
  ATTACH_CLOSE_CODES,
  type AttachClientMessage,
  attachServerMessageSchema,
} from '@oppenheimer/shared/protocol';
import { CONSUMER_CONFIG } from '../../../config';
import { trace } from '../../../trace';

/**
 * The contract between the console and whatever is feeding a terminal.
 *
 * `product/versions/mvp/01-protocol.md` decides the wire: PTY bytes as binary
 * WebSocket frames, control messages as JSON on the same socket, the browser
 * acking consumed bytes. This interface is that shape with the socket left
 * out, so the screen holds a stream and never a socket.
 */

/**
 * `offline` is the relay's `host_offline` on the attach socket (a hint, or
 * the close code): the session's host holds no link right now. The stream
 * keeps trying behind it, so it is a state rather than an end.
 */
export type StreamStatus = 'connecting' | 'live' | 'offline' | 'closed';

/**
 * Why a stream ended for good. `stopped` is the one the console acts on: the
 * session's tmux is gone and its checkouts are kept, so the pane gives way to
 * Restart rather than a reconnect ladder.
 */
export type StreamEnd =
  | 'stopped'
  | 'resolved'
  | 'missing'
  | 'unauthorized'
  | 'forbidden'
  | 'refused';

export interface SessionStream {
  /**
   * PTY output, as the bytes the socket carried. The listener calls `consumed`
   * once the terminal has drained the chunk — that is the credit 01 describes,
   * bytes the browser *consumed*, and it is what lets the runner resume a paused
   * pane. The returned function unsubscribes.
   */
  onData(listener: (chunk: Uint8Array | string, consumed: () => void) => void): () => void;
  /** The stream ended and no reconnect can change it; `onStatus` reports `closed` too. */
  onEnd(listener: (reason: StreamEnd) => void): () => void;
  /** Connection state, for the status line. The returned function unsubscribes. */
  onStatus(listener: (status: StreamStatus) => void): () => void;
  /** Keystrokes, already encoded by the terminal. */
  send(data: string): void;
  resize(cols: number, rows: number): void;
  /**
   * Skip the rest of the wait before the next reconnect and dial now: the
   * reader pressed Retry, the browser came back online, or the tab became
   * visible again. Does nothing while a dial is already in flight, once the
   * stream is live, or once it has ended.
   */
  reconnectNow(): void;
  dispose(): void;
}

/** What the transport needs from the app: a fresh ticket per socket. */
export interface SessionStreamOptions {
  /**
   * Mint an attach ticket. Called on every (re)connect, never cached: a ticket
   * is single use and sixty seconds, so the moment to mint one is the moment a
   * socket is about to be opened with it.
   */
  issueTicket: () => Promise<{ ticket: string; url: string }>;
  /**
   * The API's origin, or empty for same-origin (the default: the dev server and
   * nginx both proxy `/api` so the session cookie rides along).
   */
  apiBaseUrl?: string;
  /** Injected in tests; `WebSocket` otherwise. */
  socketFactory?: (url: string, protocols: string[]) => WebSocket;
  /** Injected in tests; `setTimeout` otherwise. */
  schedule?: (fn: () => void, ms: number) => () => void;
  /** The session this stream is for, so its marks join the other tiers' logs. */
  sessionId?: string;
}

/**
 * Close codes after which reconnecting cannot help: the answer would be the same.
 *
 * `UNAUTHORIZED` is deliberately not one of them. A ticket is single-use and
 * short-lived — the gateway *takes* it — so "this ticket did not resolve" is a
 * fact about the ticket, not about the session or the person: it is stale,
 * spent, or expired before the socket opened. Every attempt mints a fresh one,
 * so the ladder is exactly the remedy. Whether the person may attach at all is
 * decided at the mint, where a 401 does end the stream for good
 * ({@link endOfMintFailure}).
 *
 * Listing it here stranded the terminal: the status went to `closed`
 * ("Disconnected"), which draws no recovery alert — only `forbidden` and
 * `refused` do — and the status bar offers Retry only while connecting or
 * offline. The pane became a dead canvas that nothing but a page reload could
 * revive, which reads as a terminal that has stopped scrolling.
 */
const FINAL_CLOSE_CODES = new Map<number, StreamEnd>([
  [ATTACH_CLOSE_CODES.FORBIDDEN, 'forbidden'],
  [ATTACH_CLOSE_CODES.SESSION_UNAVAILABLE, 'resolved'],
  [ATTACH_CLOSE_CODES.SESSION_STOPPED, 'stopped'],
  [ATTACH_CLOSE_CODES.REFUSED, 'refused'],
]);

/**
 * How a failed ticket mint ends. A problem status the API named is a fact about
 * the session or the person and is final; anything else — the API unreachable,
 * a 5xx, a hung request — is the ladder's. `host_offline` is never said here:
 * only the attach socket may say it (01), and a mint that failed has no socket.
 */
function endOfMintFailure(error: unknown): StreamEnd | null {
  const status = (error as { status?: unknown } | null)?.status;
  switch (status) {
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'missing';
    case 409:
      // The ticket handler refuses a resolved session with 409.
      return 'resolved';
    default:
      return null;
  }
}

export function attachSocketUrl(path: string, apiBaseUrl: string | undefined): string {
  const base = apiBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const url = new URL(path, base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

type DataListener = (chunk: Uint8Array | string, consumed: () => void) => void;

/**
 * The real transport: one attach socket per stream, reconnected through the
 * ladder with a fresh ticket each time, and an epoch counter so a frame or
 * callback from a replaced socket is dropped.
 *
 * Output is delivered as raw bytes and the terminal decodes them, which keeps a
 * multi-byte character straddling two PTY reads whole. The viewport is sent
 * before the relay dispatches the attach, so the pane is not resized a frame
 * later; a resize that arrives before the socket opens waits for it.
 *
 * Constructing one dials; the hook that owns it disposes it with the terminal.
 */
export class AttachSessionStream implements SessionStream {
  private readonly dataListeners = new Set<DataListener>();
  private readonly statusListeners = new Set<(status: StreamStatus) => void>();
  private readonly endListeners = new Set<(reason: StreamEnd) => void>();
  private readonly socketFactory: (url: string, protocols: string[]) => WebSocket;
  private readonly schedule: (fn: () => void, ms: number) => () => void;
  private readonly encoder = new TextEncoder();

  private status: StreamStatus = 'connecting';
  private disposed = false;
  private epoch = 0;
  private socket: WebSocket | null = null;
  private attached = false;
  private attempt = 0;
  private cancelRetry: (() => void) | null = null;
  /** Between a failed dial and the next one, the one time `reconnectNow` may act. */
  private waiting = false;
  private viewport: { cols: number; rows: number } | null = null;
  /** The reason a `closed` control frame named, read back when the close follows. */
  private closedReason: StreamEnd | null = null;
  /** Whether any PTY byte has arrived yet, so the first one is marked once. */
  private sawBytes = false;

  constructor(private readonly options: SessionStreamOptions) {
    this.socketFactory =
      options.socketFactory ?? ((url, protocols) => new WebSocket(url, protocols));
    this.schedule =
      options.schedule ??
      ((fn, ms) => {
        const timer = setTimeout(fn, ms);
        return () => clearTimeout(timer);
      });
    trace('stream.construct', { session: options.sessionId });
    void this.connect();
  }

  onData(listener: DataListener): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  onStatus(listener: (status: StreamStatus) => void): () => void {
    // The current state first, so a subscriber never waits for a change to
    // learn where things stand.
    listener(this.status);
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onEnd(listener: (reason: StreamEnd) => void): () => void {
    this.endListeners.add(listener);
    return () => this.endListeners.delete(listener);
  }

  send(data: string): void {
    if (!this.attached || this.socket?.readyState !== WebSocket.OPEN || data.length === 0) return;
    this.socket.send(this.encoder.encode(data));
  }

  resize(cols: number, rows: number): void {
    if (cols < 1 || rows < 1) return;
    this.viewport = { cols, rows };
    this.tell({ type: 'resize', cols, rows });
  }

  reconnectNow(): void {
    if (this.disposed || !this.waiting) return;
    this.cancelRetry?.();
    this.waiting = false;
    // A fresh start: the reader or the network said now, so the next failure
    // waits the ladder's first step rather than its thirty seconds.
    this.attempt = 0;
    void this.connect();
  }

  dispose(): void {
    if (this.disposed) return;
    trace('stream.dispose', { session: this.options.sessionId });
    this.disposed = true;
    this.epoch += 1;
    this.cancelRetry?.();
    this.dataListeners.clear();
    this.endListeners.clear();
    const open = this.socket;
    this.socket = null;
    if (open && (open.readyState === WebSocket.OPEN || open.readyState === WebSocket.CONNECTING)) {
      open.close(1000, 'terminal closed');
    }
    this.setStatus('closed');
    this.statusListeners.clear();
  }

  private setStatus(next: StreamStatus): void {
    if (this.status === next) return;
    this.status = next;
    for (const listener of this.statusListeners) listener(next);
  }

  /** Over for good: say why, then say closed, and never dial again. */
  private end(reason: StreamEnd): void {
    this.cancelRetry?.();
    this.waiting = false;
    for (const listener of this.endListeners) listener(reason);
    this.setStatus('closed');
  }

  private tell(message: AttachClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private retry(after: StreamStatus): void {
    if (this.disposed) return;
    this.setStatus(after);
    const ladder = CONSUMER_CONFIG.stream.reconnectLadderMs;
    const base = ladder[Math.min(this.attempt, ladder.length - 1)];
    this.attempt += 1;
    const jitter = base * (Math.random() * 0.4 - 0.2);
    trace('stream.retry', {
      session: this.options.sessionId,
      attempt: this.attempt,
      waitMs: Math.max(0, Math.round(base + jitter)),
      after,
    });
    this.waiting = true;
    this.cancelRetry = this.schedule(
      () => {
        this.waiting = false;
        void this.connect();
      },
      Math.max(0, Math.round(base + jitter)),
    );
  }

  private async connect(): Promise<void> {
    if (this.disposed) return;
    const thisEpoch = ++this.epoch;
    this.attached = false;
    this.closedReason = null;
    trace('stream.dial', { session: this.options.sessionId, attempt: this.attempt });
    let ticket: { ticket: string; url: string };
    try {
      ticket = await this.options.issueTicket();
      trace('stream.ticket', { session: this.options.sessionId });
    } catch (error) {
      if (this.disposed || thisEpoch !== this.epoch) return;
      trace('stream.ticket-failed', {
        session: this.options.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      const final = endOfMintFailure(error);
      if (final) {
        this.end(final);
        return;
      }
      // The API could not be reached or answered with something that is not
      // an answer about this session: the ladder decides how soon to ask again.
      this.retry('connecting');
      return;
    }
    if (this.disposed || thisEpoch !== this.epoch) return;

    const ws = this.socketFactory(attachSocketUrl(ticket.url, this.options.apiBaseUrl), [
      ticket.ticket,
    ]);
    ws.binaryType = 'arraybuffer';
    this.socket = ws;

    ws.onopen = () => {
      if (thisEpoch !== this.epoch) return;
      trace('stream.socket-open', { session: this.options.sessionId });
      if (this.viewport) this.tell({ type: 'resize', ...this.viewport });
    };
    ws.onmessage = (event: MessageEvent) => {
      if (thisEpoch !== this.epoch) return;
      if (typeof event.data === 'string') {
        this.onControl(event.data);
        return;
      }
      const bytes = new Uint8Array(event.data as ArrayBuffer);
      if (bytes.byteLength === 0) return;
      if (!this.sawBytes) {
        this.sawBytes = true;
        trace('stream.first-byte', { session: this.options.sessionId, bytes: bytes.byteLength });
      }
      // The credit is the terminal's to give, once it has drained the chunk;
      // a socket that has since been replaced gives none.
      let credited = false;
      const consumed = () => {
        if (credited || thisEpoch !== this.epoch || !this.attached) return;
        credited = true;
        this.tell({ type: 'credit', bytes: bytes.byteLength });
      };
      for (const listener of this.dataListeners) listener(bytes, consumed);
    };
    ws.onclose = (event: CloseEvent) => {
      if (thisEpoch !== this.epoch) return;
      this.socket = null;
      this.attached = false;
      if (this.disposed) return;
      trace('stream.socket-close', {
        session: this.options.sessionId,
        code: event.code,
        reason: this.closedReason,
      });
      const final = this.closedReason ?? FINAL_CLOSE_CODES.get(event.code);
      if (final) {
        this.end(final);
        return;
      }
      // Host offline, link lost, a relay restart, a dropped radio: the ladder.
      this.retry(event.code === ATTACH_CLOSE_CODES.HOST_OFFLINE ? 'offline' : 'connecting');
    };
    ws.onerror = () => {
      // `onclose` follows every error and carries the code; nothing to do here.
    };
  }

  private onControl(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const message = attachServerMessageSchema.safeParse(parsed);
    if (!message.success) return;
    switch (message.data.type) {
      case 'attached':
        this.attached = true;
        this.attempt = 0;
        trace('stream.attached', { session: this.options.sessionId });
        this.setStatus('live');
        return;
      case 'hint':
        trace('stream.hint', { session: this.options.sessionId, kind: message.data.kind });
        if (message.data.kind === 'host_offline') this.setStatus('offline');
        return;
      case 'refused':
        trace('stream.refused', { session: this.options.sessionId });
        this.closedReason = 'refused';
        return;
      case 'closed':
        this.closedReason = message.data.reason;
        return;
    }
  }
}
