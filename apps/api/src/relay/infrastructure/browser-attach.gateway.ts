import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { CacheService } from '@oppenheimer/backend-cache';
import {
  ATTACH_CLOSE_CODES,
  type AttachServerMessage,
  attachClientMessageSchema,
} from '@oppenheimer/shared/protocol';
import { Repository } from 'typeorm';
import { type WebSocket, WebSocketServer } from 'ws';
import type {
  AttachmentClosedReason,
  AttachmentSink,
  LinkRegistryPort,
  RunnerLink,
} from '../../links/application/link-registry.port';
import { LINK_REGISTRY } from '../../links/links.di-tokens';
import { MemberOrmEntity } from '../../organizations/database/member.orm-entity';
import {
  ATTACH_TICKET_PREFIX,
  type AttachTicket,
  type SessionLookupPort,
} from '../../sessions/application/session-lookup.port';
import { SESSION_LOOKUP } from '../../sessions/sessions.di-tokens';
import { refuseUpgrade } from './upgrade.util';

/** The path the console opens, the one `POST /sessions/{id}/attach-ticket` names. */
export const BROWSER_ATTACH_PATH = '/api/v1/relay/attach';

/** How long the relay waits for the browser's viewport before attaching anyway. */
export const VIEWPORT_TIMEOUT_MS = 2_000;

const DEFAULT_VIEWPORT = { cols: 80, rows: 24 };

/** Keystrokes larger than this are not keystrokes. */
const MAX_INPUT_BYTES = 64 * 1024;

/** The socket a browser may leave unread before its attachment is dropped. */
const BROWSER_MAX_BUFFERED_BYTES = 4 * 1024 * 1024;

/**
 * The browser attach socket: one per attachment, unmultiplexed.
 *
 * The ticket travels in `Sec-WebSocket-Protocol` and is redeemed with a
 * read-and-delete, so a second socket presenting it is refused. What the ticket
 * authorised is re-checked at redemption — the session still attachable, the
 * person still a member of its workspace — because sixty seconds is long enough
 * for either to have changed. Then the session's host either holds a link, and
 * the attachment is opened on it with the browser's own viewport, or it does not,
 * and the socket is told `host_offline` and closed: that hint is the ticket's,
 * not the link's, and this is the one place it is said.
 */
@Injectable()
export class BrowserAttachGateway {
  private readonly logger = new Logger(BrowserAttachGateway.name);
  private readonly server = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_INPUT_BYTES,
    // Echo the ticket back as the accepted subprotocol: the browser's WebSocket
    // refuses a handshake whose response names none of the ones it offered.
    handleProtocols: (protocols) => protocols.values().next().value ?? false,
  });

  constructor(
    private readonly cache: CacheService,
    @Inject(SESSION_LOOKUP)
    private readonly sessions: SessionLookupPort,
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
    @InjectRepository(MemberOrmEntity)
    private readonly members: Repository<MemberOrmEntity>,
    private readonly configService: ConfigService,
  ) {}

  async handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    if (!this.originAllowed(request.headers.origin)) {
      refuseUpgrade(socket, 403, 'origin not allowed');
      return;
    }
    const offered = request.headers['sec-websocket-protocol'];
    const ticket = typeof offered === 'string' ? offered.split(',')[0]?.trim() : undefined;
    if (!ticket) {
      refuseUpgrade(socket, 401, 'an attach ticket is presented as the subprotocol');
      return;
    }
    const claim = await this.cache.take<AttachTicket>(`${ATTACH_TICKET_PREFIX}${ticket}`);
    if (!claim) {
      refuseUpgrade(socket, 401, 'attach ticket rejected');
      return;
    }
    const target = await this.sessions.findAttachTarget(claim.sessionId);
    if (!target || target.organizationId !== claim.organizationId || !target.attachable) {
      refuseUpgrade(socket, 409, 'session is not attachable');
      return;
    }
    const member = await this.members.exist({
      where: { organizationId: claim.organizationId, userId: claim.userId },
    });
    if (!member) {
      refuseUpgrade(socket, 403, 'not a member of the session workspace');
      return;
    }
    this.server.handleUpgrade(request, socket, head, (ws) => this.accept(ws, claim, target.hostId));
  }

  private accept(ws: WebSocket, claim: AttachTicket, hostId: string): void {
    const link = this.links.find(hostId);
    if (!link) {
      this.tell(ws, { type: 'hint', kind: 'host_offline' });
      ws.close(ATTACH_CLOSE_CODES.HOST_OFFLINE, 'host offline');
      return;
    }
    new BrowserAttachment(ws, claim, link, this.logger).start();
  }

  private tell(ws: WebSocket, message: AttachServerMessage): void {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
  }

  private originAllowed(origin: string | undefined): boolean {
    // A non-browser client sends no Origin; the ticket is what authorises it.
    if (!origin) return true;
    const allowed = [
      this.configService.get<string>('app.frontendUrl'),
      this.configService.get<string>('app.adminFrontendUrl'),
    ].filter((value): value is string => Boolean(value));
    return allowed.some((value) => sameOrigin(value, origin));
  }
}

function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

/**
 * One browser's attachment to one window, from the attach to whichever side
 * closes first. It is the `AttachmentSink` the link delivers into, and the
 * translator from the browser's vocabulary to the link's.
 */
class BrowserAttachment implements AttachmentSink {
  private attachmentId: number | null = null;
  private readonly commandId = randomUUID();
  private viewportTimer: NodeJS.Timeout | null = null;
  private attached = false;
  private finished = false;

  constructor(
    private readonly ws: WebSocket,
    private readonly claim: AttachTicket,
    private readonly link: RunnerLink,
    private readonly logger: Logger,
  ) {}

  start(): void {
    this.attachmentId = this.link.openAttachment(this, this.commandId);
    this.ws.on('message', (data, isBinary) => this.onBrowserMessage(data as Buffer, isBinary));
    this.ws.on('close', () => this.detach());
    this.ws.on('error', (error) => {
      this.logger.warn({ message: 'browser attach socket error', error: error.message });
    });
    // The attach carries the viewport so the pane is not resized a frame later;
    // a browser that never says its size gets a classic 80x24.
    this.viewportTimer = setTimeout(() => this.attach(DEFAULT_VIEWPORT), VIEWPORT_TIMEOUT_MS);
  }

  deliver(bytes: Uint8Array): void {
    if (this.ws.readyState !== this.ws.OPEN) return;
    if (this.ws.bufferedAmount > BROWSER_MAX_BUFFERED_BYTES) {
      // A client that cannot keep up is disconnected, never allowed to stall
      // the relay (02 §7).
      this.ws.close(1008, 'slow consumer');
      return;
    }
    this.ws.send(bytes, { binary: true });
  }

  closed(reason: AttachmentClosedReason, detail?: string): void {
    if (this.finished) return;
    this.finished = true;
    if (reason === 'link_lost') {
      this.tell({ type: 'hint', kind: 'host_offline', ...(detail ? { detail } : {}) });
      this.ws.close(ATTACH_CLOSE_CODES.LINK_LOST, 'link lost');
      return;
    }
    this.ws.close(ATTACH_CLOSE_CODES.SESSION_UNAVAILABLE, detail ?? 'attachment closed');
  }

  refused(code: string, detail?: string): void {
    if (this.finished) return;
    this.finished = true;
    this.tell({ type: 'refused', code, ...(detail ? { detail } : {}) });
    if (this.attachmentId !== null) this.link.closeAttachment(this.attachmentId);
    this.ws.close(ATTACH_CLOSE_CODES.REFUSED, 'attach refused');
  }

  private onBrowserMessage(data: Buffer, isBinary: boolean): void {
    if (isBinary) {
      this.input(data);
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.toString('utf8'));
    } catch {
      return;
    }
    const message = attachClientMessageSchema.safeParse(parsed);
    if (!message.success) return;
    switch (message.data.type) {
      case 'resize':
        if (!this.attached) {
          this.attach(message.data);
        } else if (this.attachmentId !== null) {
          this.link.send({
            type: 'session.resize',
            commandId: randomUUID(),
            sessionId: this.claim.sessionId,
            attachmentId: this.attachmentId,
            cols: message.data.cols,
            rows: message.data.rows,
          });
        }
        return;
      case 'credit':
        if (this.attachmentId !== null) {
          this.link.send({
            type: 'attachment.credit',
            attachmentId: this.attachmentId,
            bytes: message.data.bytes,
          });
        }
        return;
    }
  }

  private input(bytes: Buffer): void {
    if (!this.attached || bytes.byteLength === 0) return;
    this.link.send({
      type: 'session.input',
      commandId: randomUUID(),
      sessionId: this.claim.sessionId,
      window: this.claim.window,
      data: bytes.toString('base64'),
    });
  }

  private attach(viewport: { cols: number; rows: number }): void {
    if (this.attached || this.finished || this.attachmentId === null) return;
    if (this.viewportTimer) clearTimeout(this.viewportTimer);
    this.attached = true;
    const sent = this.link.send({
      type: 'session.attach',
      commandId: this.commandId,
      sessionId: this.claim.sessionId,
      window: this.claim.window,
      attachmentId: this.attachmentId,
      cols: viewport.cols,
      rows: viewport.rows,
    });
    if (!sent) {
      this.closed('link_lost');
      return;
    }
    this.tell({ type: 'attached', window: this.claim.window });
  }

  private detach(): void {
    if (this.viewportTimer) clearTimeout(this.viewportTimer);
    if (this.attachmentId === null) return;
    const id = this.attachmentId;
    this.attachmentId = null;
    // Whether or not the link is still there: freeing the id is local, and the
    // detach is only worth sending to a runner that heard the attach.
    if (this.link.attachment(id) === this) {
      this.link.closeAttachment(id);
      if (this.attached) {
        this.link.send({
          type: 'session.detach',
          commandId: randomUUID(),
          sessionId: this.claim.sessionId,
          attachmentId: id,
        });
      }
    }
    this.finished = true;
  }

  private tell(message: AttachServerMessage): void {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(message));
  }
}
