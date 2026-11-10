import type { Logger } from '@nestjs/common';
import {
  ATTACH_CLOSE_CODES,
  type AttachServerMessage,
  attachClientMessageSchema,
} from '@oppenheimer/shared/protocol';
import type { WebSocket } from 'ws';
import type { RunnerLink } from '../../links/application/link-registry.port';
import { LinkPortStream, PortClosedError, PortRefusedError } from './link-port-stream.util';

type AttachClosedReason = Extract<AttachServerMessage, { type: 'closed' }>['reason'];

/** The judgement the ticket passed, as the gateway asks it again. */
export type DesktopVerdict =
  | { allowed: true; hostId: string }
  | { allowed: false; reason: AttachClosedReason; code: number };

/**
 * What the browser's socket may hold unsent before the stream from the host
 * waits for it: a few frames of a busy screen. Below the low mark it flows
 * again.
 */
const HIGH_WATER_BYTES = 2 * 1024 * 1024;
const LOW_WATER_BYTES = 512 * 1024;

/**
 * One browser on one host's desktop (a ticket from
 * `POST /hosts/{id}/desktop-ticket`): RFB both ways as binary frames,
 * between the browser's socket and a `desktop.open` stream on the host's
 * link. The runner signed in to the screen-sharing server already and plays
 * the server's half of the handshake to the browser, so nothing here reads
 * RFB: it carries bytes under the link's two credit windows, holds the
 * browser's socket while the host's side is full, and holds the host's side
 * while the browser's socket is.
 *
 * The browser starts watching. `desktop.control` asks the runner to let its
 * clicks and keys through, or to drop them again; the runner is what drops
 * them, so a console that lied about watching changes nothing.
 *
 * Judged again on the gateway's interval, so an unpaired host or a revoked
 * grant ends a desktop already streaming.
 */
export class DesktopAttachment {
  private stream: LinkPortStream | null = null;
  private recheckTimer: NodeJS.Timeout | null = null;
  private rechecking = false;
  private finished = false;
  private opened = false;

  constructor(
    private readonly ws: WebSocket,
    private readonly link: RunnerLink,
    private readonly recheck: {
      authorize: () => Promise<DesktopVerdict>;
      everyMs: number;
      logger: Logger;
    },
  ) {}

  /** `early` is what the browser sent while its ticket was redeemed, in order. */
  start(early: readonly { data: Buffer; isBinary: boolean }[] = []): void {
    const stream = LinkPortStream.toDesktop(this.link, false);
    this.stream = stream;
    stream.whenOpen().then(
      () => {
        this.opened = true;
        this.tell({ type: 'desktop', control: false });
      },
      () => {},
    );
    stream.on('data', (chunk: Buffer) => this.toBrowser(chunk));
    stream.on('error', (error) => this.onStreamError(error));
    stream.on('end', () => this.end(1000, 'desktop closed'));
    this.ws.on('message', (data, isBinary) => this.fromBrowser(data as Buffer, isBinary));
    this.ws.on('close', () => this.detach());
    this.recheckTimer = setInterval(() => void this.reauthorize(), this.recheck.everyMs);
    this.recheckTimer.unref();
    for (const frame of early) this.fromBrowser(frame.data, frame.isBinary);
  }

  private toBrowser(chunk: Buffer): void {
    if (this.ws.readyState !== this.ws.OPEN) return;
    this.ws.send(chunk, { binary: true }, () => {
      if (this.stream?.isPaused() && this.ws.bufferedAmount < LOW_WATER_BYTES) {
        this.stream.resume();
      }
    });
    if (this.ws.bufferedAmount > HIGH_WATER_BYTES) this.stream?.pause();
  }

  private fromBrowser(data: Buffer, isBinary: boolean): void {
    const stream = this.stream;
    if (!stream || this.finished) return;
    if (isBinary) {
      if (!stream.write(data)) {
        this.ws.pause();
        stream.once('drain', () => this.ws.resume());
      }
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.toString('utf8'));
    } catch {
      return;
    }
    const message = attachClientMessageSchema.safeParse(parsed);
    if (!message.success || message.data.type !== 'desktop.control' || !this.opened) return;
    const { control } = message.data;
    if (this.link.send({ type: 'desktop.control', attachmentId: stream.id, control })) {
      this.tell({ type: 'desktop', control });
    }
  }

  private onStreamError(error: Error): void {
    if (error instanceof PortRefusedError) {
      const detail = error.message === error.code ? undefined : error.message.slice(0, 500);
      this.tell({ type: 'refused', code: error.code, ...(detail ? { detail } : {}) });
      this.end(ATTACH_CLOSE_CODES.REFUSED, 'desktop refused');
      return;
    }
    if (error instanceof PortClosedError && error.reason === 'link_lost') {
      this.tell({ type: 'hint', kind: 'host_offline' });
      this.end(ATTACH_CLOSE_CODES.LINK_LOST, 'link lost');
      return;
    }
    this.end(1000, 'desktop closed');
  }

  private async reauthorize(): Promise<void> {
    if (this.finished || this.rechecking) return;
    this.rechecking = true;
    let verdict: DesktopVerdict;
    try {
      verdict = await this.recheck.authorize();
    } catch (error) {
      this.recheck.logger.warn({
        message: 'could not re-check an open desktop; keeping it',
        error: String(error),
      });
      return;
    } finally {
      this.rechecking = false;
    }
    if (verdict.allowed || this.finished) return;
    this.tell({ type: 'closed', reason: verdict.reason });
    this.end(verdict.code, verdict.reason);
  }

  /** Closes the browser's socket; its `close` detaches the stream. */
  private end(code: number, reason: string): void {
    if (this.ws.readyState === this.ws.OPEN) this.ws.close(code, reason);
    this.detach();
  }

  private detach(): void {
    if (this.recheckTimer) clearInterval(this.recheckTimer);
    this.recheckTimer = null;
    this.finished = true;
    const stream = this.stream;
    this.stream = null;
    if (stream && !stream.destroyed) stream.destroy();
  }

  private tell(message: AttachServerMessage): void {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(message));
  }
}
