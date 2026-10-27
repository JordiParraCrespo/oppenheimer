import { randomUUID } from 'node:crypto';
import { Duplex } from 'node:stream';
import type {
  AttachmentClosedReason,
  AttachmentSink,
  RunnerLink,
} from '../../links/application/link-registry.port';
import { CreditWindow } from './credit-window.util';

/**
 * The most one frame of a port's bytes carries: well under the link's frame
 * cap, so a preview's upload never holds up the panes beside it.
 */
const CHUNK_BYTES = 64 * 1024;

/** The runner refused to open the port (`PORT_001` not the session's, `PORT_002` nothing answers). */
export class PortRefusedError extends Error {
  constructor(
    readonly code: string,
    detail?: string,
  ) {
    super(detail ?? code);
    this.name = 'PortRefusedError';
  }
}

/** The link went away, or the runner hung up before the port opened. */
export class PortClosedError extends Error {
  constructor(readonly reason: AttachmentClosedReason) {
    super(`port attachment closed: ${reason}`);
    this.name = 'PortClosedError';
  }
}

/**
 * One TCP connection to a port a session listens on, through its host's
 * runner (`product/versions/mvp/30-session-previews.md`): `port.open` on a
 * new attachment, then the connection's bytes as binary frames both ways.
 * Each direction is under the link's credit window (the contract is in
 * `@oppenheimer/shared/protocol`'s `ports.ts`): this side sends while the
 * runner has credited room (`CreditWindow`), and credits the runner for what
 * its reader took.
 *
 * It is a `Duplex`, so Node's HTTP client and a raw upgrade both run over it
 * as over a socket; the socket methods an `http.Agent` calls are no-ops.
 */
export class LinkPortStream extends Duplex {
  private readonly attachmentId: number;
  private open = false;
  private remoteEnded = false;
  /** Settles when the runner has dialled the port (`port.opened`), or fails with the attachment. */
  private readonly ready: Promise<void>;
  private markOpened: () => void = () => {};
  private markFailed: (error: Error) => void = () => {};
  /** The runner's credit for what this side sent. */
  private readonly window = new CreditWindow();
  /** Bytes delivered to the reader that the runner has not been credited for. */
  private owed = 0;
  /**
   * What the link delivers into. A field rather than this class's own
   * methods: `Duplex` already has a `closed`, which means something else.
   */
  private readonly sink: AttachmentSink = {
    deliver: (bytes) => this.onBytes(bytes),
    closed: (reason) => this.onClosed(reason),
    refused: (code, detail) => this.onRefused(code, detail),
    // A port attachment has no direct path and carries no transcript.
    signal: () => {},
    chat: () => {},
    opened: () => this.onOpened(),
    credit: (bytes) => this.onCredit(bytes),
  };

  constructor(
    private readonly link: RunnerLink,
    sessionId: string,
    port: number,
  ) {
    super({ allowHalfOpen: false });
    this.ready = new Promise((resolve, reject) => {
      this.markOpened = resolve;
      this.markFailed = reject;
    });
    // A write is what awaits it; one that never comes must not leave it unhandled.
    this.ready.catch(() => {});
    const commandId = randomUUID();
    this.attachmentId = link.openAttachment(this.sink, commandId);
    const sent = link.send({
      type: 'port.open',
      commandId,
      sessionId,
      attachmentId: this.attachmentId,
      port,
    });
    if (!sent) queueMicrotask(() => this.destroy(new PortClosedError('link_lost')));
  }

  // ---- what the runner says about this attachment

  private onOpened(): void {
    this.open = true;
    this.markOpened();
  }

  private onBytes(bytes: Uint8Array): void {
    if (this.destroyed) return;
    this.owed += bytes.length;
    if (this.push(Buffer.from(bytes))) this.flushCredit();
  }

  private onCredit(bytes: number): void {
    this.window.credit(bytes);
  }

  private onClosed(reason: AttachmentClosedReason): void {
    this.remoteEnded = true;
    if (!this.open) {
      this.destroy(new PortClosedError(reason));
      return;
    }
    this.push(null);
  }

  private onRefused(code: string, detail?: string): void {
    this.remoteEnded = true;
    this.destroy(new PortRefusedError(code, detail));
  }

  // ---- Duplex

  override _read(): void {
    this.flushCredit();
  }

  override _write(
    chunk: Buffer,
    _encoding: BufferEncoding,
    done: (error?: Error | null) => void,
  ): void {
    this.send(chunk).then(() => done(), done);
  }

  override _destroy(error: Error | null, done: (error?: Error | null) => void): void {
    const id = this.attachmentId;
    if (this.link.attachment(id) === this.sink) {
      this.link.closeAttachment(id);
      if (!this.remoteEnded) this.link.send({ type: 'port.close', attachmentId: id });
    }
    const failure = error ?? new PortClosedError('runner_closed');
    this.markFailed(failure);
    this.window.close(failure);
    done(error);
  }

  // ---- what an http.Agent calls on a socket

  setKeepAlive(): this {
    return this;
  }

  setNoDelay(): this {
    return this;
  }

  setTimeout(): this {
    return this;
  }

  ref(): this {
    return this;
  }

  unref(): this {
    return this;
  }

  private async send(chunk: Buffer): Promise<void> {
    await this.ready;
    for (let offset = 0; offset < chunk.length; ) {
      await this.window.acquire();
      const piece = chunk.subarray(offset, offset + Math.min(CHUNK_BYTES, this.window.room));
      if (!this.link.sendBinary(this.attachmentId, piece)) throw new PortClosedError('link_lost');
      this.window.sent(piece.length);
      offset += piece.length;
    }
  }

  private flushCredit(): void {
    if (this.owed === 0 || this.remoteEnded || !this.open) return;
    const bytes = this.owed;
    this.owed = 0;
    this.link.send({ type: 'attachment.credit', attachmentId: this.attachmentId, bytes });
  }
}
