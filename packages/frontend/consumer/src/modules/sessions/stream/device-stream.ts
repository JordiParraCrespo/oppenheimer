import { ATTACH_CLOSE_CODES, type AttachDeviceInput } from '@oppenheimer/shared/protocol';
import {
  openAttachSocket,
  readAttachMessage,
  reconnectDelay,
  type Schedule,
  type SocketFactory,
  timeoutSchedule,
  webSocketFactory,
} from './attach-socket';

/** Which device a session has, as its host names it. */
export interface DeviceInfo {
  serial: string;
  name: string;
  platform: 'android' | 'ios';
}

/**
 * Where a device stream stands. `unavailable` and `ended` are final: the host
 * offers the session no device, or the session itself is over.
 */
export type DeviceStatus = 'connecting' | 'live' | 'offline' | 'unavailable' | 'ended';

/** A tap, a swipe, text, a key or a button, in fractions of the screen. */
export type DeviceInput = AttachDeviceInput;

/**
 * One session's device, live: its screen as JPEG frames, the reader's input
 * back. Constructing one dials; `dispose()` closes it.
 */
export interface DeviceStream {
  /**
   * Each frame of the screen, a JPEG image. Call `drawn` once it is on
   * screen: that is the credit for the next one, so a slow reader gets fewer
   * frames, never a backlog of old ones.
   */
  onFrame(listener: (frame: Blob, drawn: () => void) => void): () => void;
  onDevice(listener: (device: DeviceInfo) => void): () => void;
  onStatus(listener: (status: DeviceStatus) => void): () => void;
  input(input: DeviceInput): void;
  dispose(): void;
}

export interface DeviceStreamOptions {
  /** Mint a device ticket. Called on every (re)connect: a ticket is single use. */
  issueTicket: () => Promise<{ ticket: string; url: string }>;
  apiBaseUrl?: string;
  /** Injected in tests; `WebSocket` otherwise. */
  socketFactory?: SocketFactory;
  /** Injected in tests; `setTimeout` otherwise. */
  schedule?: Schedule;
}

/** Close codes no reconnect can change. */
const FINAL = new Map<number, DeviceStatus>([
  [ATTACH_CLOSE_CODES.REFUSED, 'unavailable'],
  [ATTACH_CLOSE_CODES.FORBIDDEN, 'ended'],
  [ATTACH_CLOSE_CODES.SESSION_UNAVAILABLE, 'ended'],
  [ATTACH_CLOSE_CODES.SESSION_STOPPED, 'ended'],
]);

/**
 * The attach socket with a device ticket (`target: 'device'`): the same
 * relay, authorisation and re-checks as a terminal, carrying a screen.
 */
export class AttachDeviceStream implements DeviceStream {
  private readonly frameListeners = new Set<(frame: Blob, drawn: () => void) => void>();
  private readonly deviceListeners = new Set<(device: DeviceInfo) => void>();
  private readonly statusListeners = new Set<(status: DeviceStatus) => void>();
  private readonly socketFactory: SocketFactory;
  private readonly schedule: Schedule;
  private status: DeviceStatus = 'connecting';
  private device: DeviceInfo | null = null;
  private socket: WebSocket | null = null;
  private disposed = false;
  private attempt = 0;
  private cancelRetry: (() => void) | null = null;

  constructor(private readonly options: DeviceStreamOptions) {
    this.socketFactory = options.socketFactory ?? webSocketFactory;
    this.schedule = options.schedule ?? timeoutSchedule;
    void this.connect();
  }

  onFrame(listener: (frame: Blob, drawn: () => void) => void): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  onDevice(listener: (device: DeviceInfo) => void): () => void {
    if (this.device) listener(this.device);
    this.deviceListeners.add(listener);
    return () => this.deviceListeners.delete(listener);
  }

  onStatus(listener: (status: DeviceStatus) => void): () => void {
    listener(this.status);
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  input(input: DeviceInput): void {
    this.tell({ type: 'device.input', ...input });
  }

  dispose(): void {
    this.disposed = true;
    this.cancelRetry?.();
    const socket = this.socket;
    this.socket = null;
    socket?.close(1000, 'closed');
  }

  private async connect(): Promise<void> {
    if (this.disposed) return;
    let ticket: { ticket: string; url: string };
    try {
      ticket = await this.options.issueTicket();
    } catch {
      this.retry();
      return;
    }
    if (this.disposed) return;
    const socket = openAttachSocket(this.socketFactory, ticket, this.options.apiBaseUrl);
    this.socket = socket;
    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      if (typeof event.data === 'string') this.onControl(event.data);
      else this.onFrameBytes(event.data as ArrayBuffer);
    };
    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      this.socket = null;
      const final = FINAL.get(event.code);
      if (final) {
        this.setStatus(final);
        return;
      }
      this.retry();
    };
  }

  private onControl(raw: string): void {
    const message = readAttachMessage(raw);
    if (!message) return;
    switch (message.type) {
      case 'device': {
        const { type: _type, ...device } = message;
        this.device = device;
        this.attempt = 0;
        for (const listener of this.deviceListeners) listener(device);
        this.setStatus('live');
        return;
      }
      case 'hint':
        if (message.kind === 'host_offline') this.setStatus('offline');
        return;
      default:
        return;
    }
  }

  private onFrameBytes(bytes: ArrayBuffer): void {
    const frame = new Blob([bytes], { type: 'image/jpeg' });
    let credited = false;
    const drawn = () => {
      if (credited) return;
      credited = true;
      this.tell({ type: 'credit', bytes: bytes.byteLength });
    };
    if (this.frameListeners.size === 0) drawn();
    for (const listener of this.frameListeners) listener(frame, drawn);
  }

  private retry(): void {
    if (this.disposed) return;
    if (this.status === 'live') this.setStatus('connecting');
    const wait = reconnectDelay(this.attempt);
    this.attempt += 1;
    this.cancelRetry = this.schedule(() => void this.connect(), wait);
  }

  private setStatus(status: DeviceStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }

  private tell(message: object): void {
    const socket = this.socket;
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }
}
