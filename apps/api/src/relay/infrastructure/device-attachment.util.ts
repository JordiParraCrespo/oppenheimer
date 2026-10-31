import { randomUUID } from 'node:crypto';
import type { Logger } from '@nestjs/common';
import {
  ATTACH_CLOSE_CODES,
  type AttachServerMessage,
  attachClientMessageSchema,
  type DeviceInfoMessage,
} from '@oppenheimer/shared/protocol';
import type { WebSocket } from 'ws';
import type {
  AttachmentClosedReason,
  AttachmentSink,
  RunnerLink,
} from '../../links/application/link-registry.port';
import type { AttachTicket } from '../../sessions/application/session-lookup.port';
import { clampCredit, creditSender } from './coalescing-sender.util';

type AttachClosedReason = Extract<AttachServerMessage, { type: 'closed' }>['reason'];

/** The judgement the ticket passed, as the gateway asks it again. */
export type DeviceVerdict =
  | { allowed: true }
  | { allowed: false; reason: AttachClosedReason; code: number };

/** The socket a browser may leave unread before its screen is dropped. */
const MAX_BUFFERED_BYTES = 4 * 1024 * 1024;

/**
 * One browser watching a session's device (a ticket minted with
 * `target: 'device'`): the runner's JPEG frames out as binary frames, the
 * browser's taps and keys in as `device.input`, its credit relayed as for a
 * terminal. The browser never names a device: the runner applies input to the
 * session's own (`product/research/device-streaming.md`).
 *
 * It shares the terminal's socket path, ticket and authorisation, and is
 * judged again on the same interval, so a revoked grant or a stopped session
 * ends a screen the way it ends a terminal.
 */
export class DeviceAttachment implements AttachmentSink {
  private attachmentId: number | null = null;
  private readonly commandId = randomUUID();
  private recheckTimer: NodeJS.Timeout | null = null;
  private rechecking = false;
  private finished = false;
  /** A read-only share watches: its input is dropped here. */
  private readonly readOnly: boolean;
  private readonly credits = creditSender((bytes) => {
    if (this.attachmentId === null) return;
    this.link.send({ type: 'attachment.credit', attachmentId: this.attachmentId, bytes });
  });

  constructor(
    private readonly ws: WebSocket,
    private readonly claim: AttachTicket,
    private readonly link: RunnerLink,
    private readonly recheck: {
      authorize: () => Promise<DeviceVerdict>;
      everyMs: number;
      logger: Logger;
    },
  ) {
    this.readOnly = claim.share?.readOnly ?? false;
  }

  /** `early` is what the browser sent while its ticket was redeemed, in order. */
  start(early: readonly { data: Buffer; isBinary: boolean }[] = []): void {
    this.attachmentId = this.link.openAttachment(this, this.commandId);
    this.ws.on('message', (data, isBinary) => this.onBrowserMessage(data as Buffer, isBinary));
    this.ws.on('close', () => this.detach());
    const sent = this.link.send({
      type: 'device.attach',
      commandId: this.commandId,
      sessionId: this.claim.sessionId,
      attachmentId: this.attachmentId,
    });
    if (!sent) {
      this.closed('link_lost');
      return;
    }
    this.tell({ type: 'attached', window: this.claim.window });
    this.recheckTimer = setInterval(() => void this.reauthorize(), this.recheck.everyMs);
    this.recheckTimer.unref();
    for (const frame of early) this.onBrowserMessage(frame.data, frame.isBinary);
  }

  /** One frame of the screen, a whole JPEG image. */
  deliver(bytes: Uint8Array): void {
    if (this.ws.readyState !== this.ws.OPEN) return;
    if (this.ws.bufferedAmount > MAX_BUFFERED_BYTES) {
      this.ws.close(1008, 'slow consumer');
      return;
    }
    this.ws.send(bytes, { binary: true });
  }

  device(message: DeviceInfoMessage): void {
    if (this.finished) return;
    this.tell({
      type: 'device',
      serial: message.serial,
      name: message.name,
      platform: message.platform,
    });
  }

  closed(reason: AttachmentClosedReason, detail?: string): void {
    if (this.finished) return;
    this.finished = true;
    this.stopTimer();
    if (reason === 'link_lost') {
      this.tell({ type: 'hint', kind: 'host_offline', ...(detail ? { detail } : {}) });
      this.ws.close(ATTACH_CLOSE_CODES.LINK_LOST, 'link lost');
      return;
    }
    this.ws.close(ATTACH_CLOSE_CODES.SESSION_UNAVAILABLE, detail ?? 'device closed');
  }

  refused(code: string, detail?: string): void {
    if (this.finished) return;
    this.finished = true;
    this.stopTimer();
    this.tell({ type: 'refused', code, ...(detail ? { detail } : {}) });
    if (this.attachmentId !== null) this.link.closeAttachment(this.attachmentId);
    this.ws.close(ATTACH_CLOSE_CODES.REFUSED, 'device refused');
  }

  /** A device attachment has no direct path. */
  signal(): void {}

  /** A device attachment carries no transcript. */
  chat(): void {}

  private onBrowserMessage(data: Buffer, isBinary: boolean): void {
    if (isBinary || this.attachmentId === null || this.finished) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.toString('utf8'));
    } catch {
      return;
    }
    const message = attachClientMessageSchema.safeParse(parsed);
    if (!message.success) return;
    if (message.data.type === 'credit') {
      // Held to a rate and clamped as a terminal's is: every screen on the host
      // shares its one link.
      this.credits.push(clampCredit(message.data.bytes));
      return;
    }
    if (message.data.type === 'device.input' && !this.readOnly) {
      const { type: _type, ...input } = message.data;
      this.link.send({ type: 'device.input', attachmentId: this.attachmentId, ...input });
    }
  }

  private async reauthorize(): Promise<void> {
    if (this.finished || this.rechecking) return;
    this.rechecking = true;
    let verdict: DeviceVerdict;
    try {
      verdict = await this.recheck.authorize();
    } catch (error) {
      this.recheck.logger.warn({
        message: 'could not re-check an open device attachment; keeping it',
        sessionId: this.claim.sessionId,
        error: String(error),
      });
      return;
    } finally {
      this.rechecking = false;
    }
    if (verdict.allowed || this.finished) return;
    this.tell({ type: 'closed', reason: verdict.reason });
    this.detach();
    this.ws.close(verdict.code, verdict.reason);
  }

  private detach(): void {
    this.stopTimer();
    if (this.attachmentId === null) return;
    const id = this.attachmentId;
    this.attachmentId = null;
    if (this.link.attachment(id) === this) {
      this.link.closeAttachment(id);
      this.link.send({
        type: 'device.detach',
        commandId: randomUUID(),
        sessionId: this.claim.sessionId,
        attachmentId: id,
      });
    }
    this.finished = true;
  }

  private stopTimer(): void {
    if (this.recheckTimer) clearInterval(this.recheckTimer);
    this.recheckTimer = null;
    this.credits.dispose();
  }

  private tell(message: AttachServerMessage): void {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(message));
  }
}
