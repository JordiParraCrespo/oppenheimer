import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SCOPE_RESOLVER, type ScopeResolverPort } from '@oppenheimer/backend-authz';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import {
  ATTACH_CLOSE_CODES,
  type AttachServerMessage,
  attachClientMessageSchema,
} from '@oppenheimer/shared/protocol';

type AttachClosedReason = Extract<AttachServerMessage, { type: 'closed' }>['reason'];

/**
 * What judging a claim concludes: attach on the session's host, or close with
 * this reason and code. Asked at redemption and again on a timer while the
 * attachment is open.
 */
type AttachVerdict =
  | { allowed: true; hostId: string }
  | { allowed: false; reason: AttachClosedReason; code: number };

import { type WebSocket, WebSocketServer } from 'ws';
import type { CredentialOwnerPort } from '../../auth/application/credential-owner.port';
import { CREDENTIAL_OWNER } from '../../auth/auth.di-tokens';
import type { HostAccessPort } from '../../hosts/application/host-access.port';
import { HOST_ACCESS } from '../../hosts/hosts.di-tokens';
import type {
  AttachmentClosedReason,
  AttachmentSink,
  LinkRegistryPort,
  RunnerLink,
} from '../../links/application/link-registry.port';
import { LINK_REGISTRY } from '../../links/links.di-tokens';
import type { WorkspaceLookupPort } from '../../organizations/application/workspace-lookup.port';
import { WORKSPACE_LOOKUP } from '../../organizations/organizations.di-tokens';
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

/**
 * Frames held while a ticket is redeemed. The browser sends one, its viewport,
 * the moment the socket opens; anything past a handful is not a browser
 * waiting for an answer, and is dropped.
 */
const MAX_EARLY_FRAMES = 8;

/** Keystrokes larger than this are not keystrokes. */
const MAX_INPUT_BYTES = 64 * 1024;

/** The socket a browser may leave unread before its attachment is dropped. */
const BROWSER_MAX_BUFFERED_BYTES = 4 * 1024 * 1024;

/**
 * How often an open attachment is judged again, the way its ticket was. What
 * can end one — a grant revoked, a membership removed (Better Auth writes it
 * and raises no event), an account banned, a session stopped — is either not
 * an event at all or an outbox event that reaches one replica, while the
 * attachment lives in whichever process holds the socket. A timer on every
 * attachment bounds revocation to this interval on every replica, with no
 * pub/sub. Paired on purpose with `OWNER_RECHECK_MS` in
 * hosts/application/host-presence.resolver.ts: both re-check on the same minute.
 */
export const REAUTHORIZE_INTERVAL_MS = 60_000;

/**
 * The browser attach socket: one per attachment, unmultiplexed.
 *
 * The ticket travels in `Sec-WebSocket-Protocol` and is redeemed with a
 * read-and-delete, so a second socket presenting it is refused. What it authorised
 * is re-checked at redemption (session live, person still a workspace member through
 * `organizations/`' port, account allowed to act, host still usable), since sixty
 * seconds is long enough for any of it to change, and again every
 * `REAUTHORIZE_INTERVAL_MS`, so a revocation reaches a terminal already streaming.
 *
 * Every refusal after the handshake is **a message and a close code on an
 * established socket**, never a refused upgrade: a browser sees a refused upgrade
 * only as a 1006, which it takes for a dropped radio and retries. Only a request with
 * no ticket, or from an origin this API does not serve, is refused before the
 * upgrade; a browser this app serves sends neither.
 *
 * A host with no link gets the `host_offline` hint and a close, at redemption
 * and again when an open attachment's link is lost.
 */
@Injectable()
export class BrowserAttachGateway {
  /** `REAUTHORIZE_INTERVAL_MS`; a field only so a test can shorten it. */
  reauthorizeIntervalMs = REAUTHORIZE_INTERVAL_MS;
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
    @Inject(WORKSPACE_LOOKUP)
    private readonly workspaces: WorkspaceLookupPort,
    private readonly configService: ConfigService,
    @Inject(SCOPE_RESOLVER)
    private readonly scopes: ScopeResolverPort,
    @Inject(HOST_ACCESS)
    private readonly hostAccess: HostAccessPort,
    @Inject(CREDENTIAL_OWNER)
    private readonly owners: CredentialOwnerPort,
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
    this.server.handleUpgrade(request, socket, head, (ws) => {
      // `ws` emits 'error' for a frame it cannot accept (over maxPayload, bad
      // UTF-8, unmasked…). An 'error' nobody listens for throws and takes the
      // process with it, and this socket is not authenticated yet.
      ws.on('error', (error) => {
        this.logger.warn({ message: 'browser attach socket error', error: error.message });
      });
      void this.redeem(ws, ticket).catch((error: unknown) => {
        this.logger.error({ message: 'attach ticket could not be judged', error: String(error) });
        // No `closed` message: every reason it can carry is a final verdict,
        // and a store that did not answer is not one. 1011 rather than
        // SESSION_UNAVAILABLE, which the console takes as final: 1011 it retries.
        if (ws.readyState === ws.OPEN) ws.close(1011, 'try again');
      });
    });
  }

  private async redeem(ws: WebSocket, ticket: string): Promise<void> {
    // The browser sends its viewport as soon as the socket opens, which is
    // while the lookups below are still out. `ws` drops a frame nobody listens
    // for, so without this hold the resize was lost whenever redemption was
    // slower than the browser, and the relay sat out `VIEWPORT_TIMEOUT_MS`
    // before attaching at 80x24: two seconds on some session switches.
    const early: EarlyFrame[] = [];
    const hold = (data: unknown, isBinary: boolean) => {
      if (early.length < MAX_EARLY_FRAMES) early.push({ data: data as Buffer, isBinary });
    };
    ws.on('message', hold);
    try {
      await this.judge(ws, ticket, early);
    } finally {
      ws.off('message', hold);
      // An attachment took its own copy; on a refusal nothing did, and a slow
      // close handshake must not keep the frames alive.
      early.length = 0;
    }
  }

  private async judge(ws: WebSocket, ticket: string, early: EarlyFrame[]): Promise<void> {
    const claim = await this.cache.take<AttachTicket>(`${ATTACH_TICKET_PREFIX}${ticket}`);
    if (!claim) {
      this.end(ws, 'unauthorized', ATTACH_CLOSE_CODES.UNAUTHORIZED);
      return;
    }
    const verdict = await this.authorize(claim);
    if (!verdict.allowed) {
      this.end(ws, verdict.reason, verdict.code);
      return;
    }
    const link = this.links.find(verdict.hostId);
    if (!link) {
      this.tell(ws, { type: 'hint', kind: 'host_offline' });
      ws.close(ATTACH_CLOSE_CODES.HOST_OFFLINE, 'host offline');
      return;
    }
    // A browser that left while the ticket was judged has nothing to attach,
    // and its `close` has already fired: an attachment opened now would never
    // be detached.
    if (ws.readyState !== ws.OPEN) return;
    new BrowserAttachment(ws, claim, link, {
      authorize: () => this.authorize(claim),
      everyMs: this.reauthorizeIntervalMs,
      logger: this.logger,
    }).start([...early]);
  }

  /**
   * Whether a claim still authorises an attachment. A lookup that throws is
   * thrown, never read as a refusal: at redemption that is a 1011 the console
   * retries, and on the timer it keeps the socket.
   */
  private async authorize(claim: AttachTicket): Promise<AttachVerdict> {
    // Through a share link, the link first: revoked or expired ends it
    // whatever its creator may still do, and a signed-in holder whose own
    // account was banned since holds nothing either. The rest is the
    // creator's judgement, below, exactly as their own terminal's.
    if (claim.share) {
      const link = await this.sessions.findShareLinkTarget(claim.share.linkId);
      if (
        !link?.live ||
        link.sessionId !== claim.sessionId ||
        link.organizationId !== claim.organizationId ||
        link.createdByUserId !== claim.userId
      ) {
        return refuse('unauthorized', ATTACH_CLOSE_CODES.UNAUTHORIZED);
      }
      if (
        claim.share.viewerUserId &&
        !(await this.owners.findActiveOwner(claim.share.viewerUserId))
      ) {
        return refuse('forbidden', ATTACH_CLOSE_CODES.FORBIDDEN);
      }
    }
    const target = await this.sessions.findAttachTarget(claim.sessionId);
    if (!target || target.organizationId !== claim.organizationId) {
      return refuse('missing', ATTACH_CLOSE_CODES.SESSION_UNAVAILABLE);
    }
    if (target.state === 'resolved')
      return refuse('resolved', ATTACH_CLOSE_CODES.SESSION_UNAVAILABLE);
    if (target.state === 'stopped') return refuse('stopped', ATTACH_CLOSE_CODES.SESSION_STOPPED);
    if (!(await this.workspaces.isMember(claim.organizationId, claim.userId))) {
      return refuse('forbidden', ATTACH_CLOSE_CODES.FORBIDDEN);
    }
    // A banned or deactivated account holds no PTY, whatever its ticket says.
    if (!(await this.owners.findActiveOwner(claim.userId))) {
      return refuse('forbidden', ATTACH_CLOSE_CODES.FORBIDDEN);
    }
    // The same own-or-granted predicate a create asks, so a revoked grant or
    // an unpaired host ends the PTY. `isPlatformAdmin: false` is deliberate: a
    // superadmin who neither owns the host nor holds a grant on it gets no
    // shell on it through a ticket either.
    const scope = await this.scopes.resolve({
      userId: claim.userId,
      organizationId: claim.organizationId,
      isPlatformAdmin: false,
      hasFullAccess: false,
    });
    try {
      await this.hostAccess.assertUsable(scope, target.hostId);
    } catch (error) {
      // The port's refusal is its not-found problem; anything else is a fault.
      if (error instanceof AppError && error.getStatus() === 404) {
        return refuse('forbidden', ATTACH_CLOSE_CODES.FORBIDDEN);
      }
      throw error;
    }
    return { allowed: true, hostId: target.hostId };
  }

  /** A final answer: the reason as a control frame, then the code. */
  private end(ws: WebSocket, reason: AttachClosedReason, code: number): void {
    this.tell(ws, { type: 'closed', reason });
    ws.close(code, reason);
  }

  private tell(ws: WebSocket, message: AttachServerMessage): void {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
  }

  private originAllowed(origin: string | undefined): boolean {
    // A non-browser client sends no Origin; the ticket is what authorises it.
    if (!origin) return true;
    const allowed = this.configService.get<string>('app.frontendUrl');
    return Boolean(allowed) && sameOrigin(allowed as string, origin);
  }
}

/** A frame the browser sent before its attachment was listening. */
interface EarlyFrame {
  data: Buffer;
  isBinary: boolean;
}

function refuse(reason: AttachClosedReason, code: number): AttachVerdict {
  return { allowed: false, reason, code };
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
  private recheckTimer: NodeJS.Timeout | null = null;
  private rechecking = false;
  private attached = false;
  private finished = false;

  constructor(
    private readonly ws: WebSocket,
    private readonly claim: AttachTicket,
    private readonly link: RunnerLink,
    /** The judgement the ticket passed, asked again every `everyMs`. */
    private readonly recheck: {
      authorize: () => Promise<AttachVerdict>;
      everyMs: number;
      logger: Logger;
    },
  ) {}

  /** `early` is what the browser sent while its ticket was redeemed, in order. */
  start(early: readonly EarlyFrame[] = []): void {
    this.attachmentId = this.link.openAttachment(this, this.commandId);
    this.ws.on('message', (data, isBinary) => this.onBrowserMessage(data as Buffer, isBinary));
    this.ws.on('close', () => this.detach());
    // The attach carries the viewport so the pane is not resized a frame later;
    // a browser that never says its size gets a classic 80x24.
    this.viewportTimer = setTimeout(() => this.attach(DEFAULT_VIEWPORT), VIEWPORT_TIMEOUT_MS);
    // Unref'd: an open terminal's re-check is no reason to keep a process up.
    this.recheckTimer = setInterval(() => void this.reauthorize(), this.recheck.everyMs);
    this.recheckTimer.unref();
    for (const frame of early) this.onBrowserMessage(frame.data, frame.isBinary);
  }

  /**
   * Judge the claim again. A refusal ends the attachment the way redemption
   * would have: `closed` with the reason, the runner told to detach, then the
   * final code. A check that throws (a database blip) is logged and the socket
   * kept, so an outage does not drop every terminal at once.
   */
  private async reauthorize(): Promise<void> {
    if (this.finished || this.rechecking) return;
    this.rechecking = true;
    let verdict: AttachVerdict;
    try {
      verdict = await this.recheck.authorize();
    } catch (error) {
      this.recheck.logger.warn({
        message: 'could not re-check an open attachment; keeping it',
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

  /**
   * Keystrokes are the attach socket's binary frames, copied onto the link as
   * binary frames under this attachment's id — the same frame layout the PTY's
   * output uses the other way. No JSON, no base64, no window lookup on the host:
   * the runner writes them to the PTY the id names (`session.input` is the
   * control plane's own path for a window nobody is watching).
   */
  private input(bytes: Buffer): void {
    if (!this.attached || this.attachmentId === null || bytes.byteLength === 0) return;
    // A read-only share link watches. The host attached tmux read-only too;
    // this is the relay's half, so a runner that predates the flag still
    // never sees a keystroke from it.
    if (this.claim.share?.readOnly) return;
    this.link.sendBinary(this.attachmentId, bytes);
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
      ...(this.claim.share?.readOnly ? { readOnly: true } : {}),
    });
    if (!sent) {
      this.closed('link_lost');
      return;
    }
    this.tell({ type: 'attached', window: this.claim.window });
  }

  private detach(): void {
    if (this.viewportTimer) clearTimeout(this.viewportTimer);
    if (this.recheckTimer) clearInterval(this.recheckTimer);
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
