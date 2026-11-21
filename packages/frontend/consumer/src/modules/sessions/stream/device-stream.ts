import { ATTACH_CLOSE_CODES, type AttachDeviceInput } from '@oppenheimer/shared/protocol';
import { CONSUMER_CONFIG } from '../../../config';
import {
  openAttachSocket,
  readAttachMessage,
  reconnectDelay,
  type Schedule,
  type SocketFactory,
  timeoutSchedule,
  webSocketFactory,
} from './attach-socket';

/** One device the session's host offers: `free` when no other session holds it. */
export interface DeviceChoice {
  serial: string;
  name: string;
  platform: 'android' | 'ios';
  free: boolean;
}

/**
 * Which device a session has, as its host names it, and the host's devices it
 * could move to (absent on a runner that cannot move it).
 */
export interface DeviceInfo {
  serial: string;
  name: string;
  platform: 'android' | 'ios';
  devices?: DeviceChoice[];
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
  /**
   * Send a gesture or key to the device. Input sent while the stream is not
   * live (its socket redialling) is held, at most `HELD_INPUT_MAX` for
   * `CONSUMER_CONFIG.device.heldInputMs` each, and sent in order once it is live again.
   */
  input(input: DeviceInput): void;
  /**
   * Move the session onto another of its host's devices, one `devices` lists
   * as free. The screen switches in place; `onDevice` says which it has after.
   */
  select(serial: string): void;
  /**
   * Dial again now: the host looks at its devices afresh and restarts the
   * screen. Works from any status, `unavailable` included, so a simulator
   * booted since can be picked up.
   */
  refresh(): void;
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

/**
 * The most input held while the stream is not live: a few taps and a swipe,
 * not a backlog that would replay a minute of clicking on the device.
 */
const HELD_INPUT_MAX = 16;

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
  /** Each dial's number: a dial a refresh overtook drops its socket unopened. */
  private dial = 0;
  /** Input sent while not live, oldest first, each with its expiry's cancel. */
  private held: { input: DeviceInput; expire: () => void }[] = [];

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
    if (this.disposed) return;
    if (this.status === 'live' && this.isOpen()) {
      this.tell({ type: 'device.input', ...input });
      return;
    }
    if (this.status === 'unavailable' || this.status === 'ended') return;
    if (this.held.length >= HELD_INPUT_MAX) this.held.shift()?.expire();
    const entry = {
      input,
      expire: this.schedule(() => {
        this.held = this.held.filter((held) => held !== entry);
      }, CONSUMER_CONFIG.device.heldInputMs),
    };
    this.held.push(entry);
  }

  select(serial: string): void {
    this.tell({ type: 'device.select', serial });
  }

  refresh(): void {
    if (this.disposed) return;
    this.cancelRetry?.();
    this.cancelRetry = null;
    const socket = this.socket;
    // Forgotten first, so its close is not taken for a drop to retry.
    this.socket = null;
    socket?.close(1000, 'refresh');
    this.attempt = 0;
    this.setStatus('connecting');
    void this.connect();
  }

  dispose(): void {
    this.disposed = true;
    this.cancelRetry?.();
    this.dropHeld();
    const socket = this.socket;
    this.socket = null;
    socket?.close(1000, 'closed');
  }

  private async connect(): Promise<void> {
    if (this.disposed) return;
    this.dial += 1;
    const dial = this.dial;
    let ticket: { ticket: string; url: string };
    try {
      ticket = await this.options.issueTicket();
    } catch {
      if (dial === this.dial) this.retry();
      return;
    }
    if (this.disposed || dial !== this.dial) return;
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
        this.dropHeld();
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
        this.sendHeld();
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

  /** The input held while the stream was not live, in the order it was sent. */
  private sendHeld(): void {
    const held = this.held;
    this.held = [];
    for (const { input, expire } of held) {
      expire();
      this.tell({ type: 'device.input', ...input });
    }
  }

  private dropHeld(): void {
    for (const { expire } of this.held) expire();
    this.held = [];
  }

  private isOpen(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  private tell(message: object): void {
    const socket = this.socket;
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }
}
