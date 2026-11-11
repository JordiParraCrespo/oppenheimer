import { ATTACH_CLOSE_CODES } from '@oppenheimer/shared/protocol';
import {
  openAttachSocket,
  readAttachMessage,
  type SocketFactory,
  webSocketFactory,
} from '../../sessions/stream/attach-socket';

/**
 * Where a host's desktop stands. `unavailable` and `ended` are final: the
 * host does not share its desktop (or cannot), or the reader may no longer
 * use the host. `offline` and `dropped` are worth dialling again.
 */
export type DesktopStatus = 'connecting' | 'live' | 'offline' | 'unavailable' | 'ended' | 'dropped';

/** Why the host refused: its runner's catalog code (`DESKTOP_001`…) and what it said. */
export interface DesktopRefusal {
  code: string;
  detail?: string;
}

export interface DesktopState {
  status: DesktopStatus;
  /** Whether the reader's clicks and keys reach the desktop, as the host last said. */
  control: boolean;
  refusal: DesktopRefusal | null;
}

/** What a VNC viewer reads off a close, as a `CloseEvent` carries it. */
interface DesktopCloseEvent {
  code: number;
  reason: string;
  wasClean: boolean;
}

export interface DesktopConnectionOptions {
  /** Mint a desktop ticket; a connection is one ticket, one socket. */
  issueTicket: () => Promise<{ ticket: string; url: string }>;
  apiBaseUrl?: string;
  /** Injected in tests; `WebSocket` otherwise. */
  socketFactory?: SocketFactory;
}

/** Close codes no new dial can change, and what each one means. */
const FINAL = new Map<number, DesktopStatus>([
  [ATTACH_CLOSE_CODES.REFUSED, 'unavailable'],
  [ATTACH_CLOSE_CODES.FORBIDDEN, 'ended'],
  [ATTACH_CLOSE_CODES.SESSION_UNAVAILABLE, 'ended'],
]);

const OFFLINE = new Set<number>([ATTACH_CLOSE_CODES.HOST_OFFLINE, ATTACH_CLOSE_CODES.LINK_LOST]);

/**
 * One host's desktop over the relay's desktop socket: a single dial, which a
 * VNC viewer takes as its channel. It has the shape of a `WebSocket` that
 * carries only RFB (`binaryType`, `readyState`, `send`, `close` and the four
 * handlers), because noVNC accepts any channel of that shape, and it keeps
 * the relay's own frames to itself: it is `open` only once the host has
 * signed in to its screen-sharing server (`desktop`), so the viewer's
 * handshake starts with the server's first byte, and a refusal or a lost host
 * reaches the reader as a `DesktopState`, not as bytes.
 *
 * The reader starts watching; `setControl` asks the host to let their clicks
 * and keys through. It is the host that drops them while they only watch.
 */
export class AttachDesktopConnection {
  binaryType = 'arraybuffer';
  readonly protocol = '';
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: DesktopCloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  private messageHandler: ((event: { data: ArrayBuffer }) => void) | null = null;
  private socket: WebSocket | null = null;
  private opened = false;
  private closed = false;
  /** RFB that arrived before `desktop`, handed to the viewer once it is open. */
  private early: ArrayBuffer[] = [];
  private state: DesktopState = { status: 'connecting', control: false, refusal: null };
  private readonly listeners = new Set<(state: DesktopState) => void>();
  private readonly socketFactory: SocketFactory;

  constructor(private readonly options: DesktopConnectionOptions) {
    this.socketFactory = options.socketFactory ?? webSocketFactory;
    void this.dial();
  }

  /**
   * Where RFB goes. Should a viewer attach after the host signed in, what
   * arrived before it is handed over on the next microtask: noVNC sets this
   * inside its `attach` and only opens its handshake once `attach` returns,
   * so bytes delivered from inside the setter would reach it too early.
   */
  get onmessage(): ((event: { data: ArrayBuffer }) => void) | null {
    return this.messageHandler;
  }

  set onmessage(handler: ((event: { data: ArrayBuffer }) => void) | null) {
    this.messageHandler = handler;
    if (handler && this.opened) queueMicrotask(() => this.flushEarly());
  }

  get readyState(): 'connecting' | 'open' | 'closing' | 'closed' {
    if (this.closed) return 'closed';
    return this.opened ? 'open' : 'connecting';
  }

  /** The reader's state now, and on every change, until the returned call. */
  onState(listener: (state: DesktopState) => void): () => void {
    listener(this.state);
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Take control of the desktop, or go back to watching it. */
  setControl(control: boolean): void {
    this.tell({ type: 'desktop.control', control });
  }

  send(data: BufferSource): void {
    const socket = this.socket;
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(data);
  }

  close(): void {
    const socket = this.socket;
    this.socket = null;
    socket?.close(1000, 'closed');
    this.finish({ code: 1000, reason: 'closed', wasClean: true });
  }

  private async dial(): Promise<void> {
    let ticket: { ticket: string; url: string };
    try {
      ticket = await this.options.issueTicket();
    } catch {
      this.update({ status: 'dropped' });
      this.finish({ code: 1006, reason: 'no ticket', wasClean: false });
      return;
    }
    if (this.closed) return;
    const socket = openAttachSocket(this.socketFactory, ticket, this.options.apiBaseUrl);
    this.socket = socket;
    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      if (typeof event.data === 'string') this.onControl(event.data);
      else if (this.opened && this.messageHandler) this.messageHandler({ data: event.data });
      else this.early.push(event.data as ArrayBuffer);
    };
    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      this.socket = null;
      const final = FINAL.get(event.code);
      if (final) this.update({ status: final });
      else if (OFFLINE.has(event.code)) this.update({ status: 'offline' });
      else if (this.state.status !== 'offline') this.update({ status: 'dropped' });
      this.finish({ code: event.code, reason: event.reason, wasClean: event.wasClean });
    };
  }

  private onControl(raw: string): void {
    const message = readAttachMessage(raw);
    if (!message) return;
    switch (message.type) {
      case 'desktop':
        this.update({ status: 'live', control: message.control });
        if (!this.opened) {
          this.opened = true;
          this.onopen?.(new Event('open'));
          this.flushEarly();
        }
        return;
      case 'refused':
        this.update({
          refusal: { code: message.code, ...(message.detail ? { detail: message.detail } : {}) },
        });
        return;
      case 'hint':
        if (message.kind === 'host_offline') this.update({ status: 'offline' });
        return;
      default:
        return;
    }
  }

  private flushEarly(): void {
    const handler = this.messageHandler;
    if (!handler) return;
    for (const data of this.early.splice(0)) handler({ data });
  }

  private finish(event: DesktopCloseEvent): void {
    if (this.closed) return;
    this.closed = true;
    this.onclose?.(event);
  }

  private update(change: Partial<DesktopState>): void {
    this.state = { ...this.state, ...change };
    for (const listener of this.listeners) listener(this.state);
  }

  private tell(message: object): void {
    const socket = this.socket;
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }
}
