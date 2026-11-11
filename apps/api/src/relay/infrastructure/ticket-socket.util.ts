import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Logger } from '@nestjs/common';
import type { AttachServerMessage } from '@oppenheimer/shared/protocol';
import { type WebSocket, WebSocketServer } from 'ws';
import { keepSocketAlive } from './socket-keepalive.util';
import { refuseUpgrade } from './upgrade.util';

type AttachClosedReason = Extract<AttachServerMessage, { type: 'closed' }>['reason'];

/** A frame the browser sent before the socket's owner was listening. */
export interface EarlyFrame {
  data: Buffer;
  isBinary: boolean;
}

/**
 * Frames held while a ticket is redeemed. A browser sends a handful at most
 * before it hears back (a terminal its viewport, a desktop none); anything
 * past that is not a browser waiting for an answer, and is dropped.
 */
const MAX_EARLY_FRAMES = 8;

export interface TicketSocketOptions {
  /** What the logs call this socket ("attach", "desktop"). */
  name: string;
  /** The largest frame the browser may send. */
  maxPayload: number;
  /** How often to ping; read at each upgrade, so a test can shorten it. */
  pingIntervalMs: () => number;
  /** The console's origin (`app.frontendUrl`); a browser from any other is refused. */
  frontendUrl: () => string | undefined;
  logger: Logger;
  /**
   * Redeem `ticket` and attach `ws`, with what the browser sent meanwhile.
   * A throw is a store that did not answer, not a verdict: the socket closes
   * 1011, which the console retries.
   */
  redeem: (ws: WebSocket, ticket: string, early: EarlyFrame[]) => Promise<void>;
}

/**
 * A browser socket that a single-use ticket opens: the lifecycle the attach
 * socket and the desktop socket share, so each gateway keeps only its own
 * judgement and its own attachment.
 *
 * The ticket travels in `Sec-WebSocket-Protocol` (a browser can set a
 * subprotocol but not a header, and request lines are logged) and is echoed
 * back as the accepted one, which the browser requires. Only a request with
 * no ticket, or from an origin this API does not serve, is refused before the
 * upgrade; every later refusal is a message and a close code on an
 * established socket (`endSocket`), because a browser sees a refused upgrade
 * only as a 1006 and retries.
 *
 * From the upgrade on, the socket is pinged (`keepSocketAlive`), and what the
 * browser sends while the ticket is judged is held, in order, for `redeem`:
 * `ws` drops a frame nobody listens for.
 */
export class TicketSocket {
  private readonly server: WebSocketServer;

  constructor(private readonly options: TicketSocketOptions) {
    this.server = new WebSocketServer({
      noServer: true,
      maxPayload: options.maxPayload,
      handleProtocols: (protocols) => protocols.values().next().value ?? false,
    });
  }

  async handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    if (!this.originAllowed(request.headers.origin)) {
      refuseUpgrade(socket, 403, 'origin not allowed');
      return;
    }
    const offered = request.headers['sec-websocket-protocol'];
    const ticket = typeof offered === 'string' ? offered.split(',')[0]?.trim() : undefined;
    if (!ticket) {
      refuseUpgrade(socket, 401, `a ticket is presented as the subprotocol`);
      return;
    }
    this.server.handleUpgrade(request, socket, head, (ws) => {
      // `ws` emits 'error' for a frame it cannot accept (over maxPayload, bad
      // UTF-8, unmasked…). An 'error' nobody listens for throws and takes the
      // process with it, and this socket is not authenticated yet.
      ws.on('error', (error) => {
        this.options.logger.warn({
          message: `${this.options.name} socket error`,
          error: error.message,
        });
      });
      // From the upgrade, not the attach: a socket that vanished while its
      // ticket was judged is as dead as one that vanished mid-stream.
      keepSocketAlive(ws, this.options.pingIntervalMs());
      void this.hold(ws, ticket).catch((error: unknown) => {
        this.options.logger.error({
          message: `${this.options.name} ticket could not be judged`,
          error: String(error),
        });
        if (ws.readyState === ws.OPEN) ws.close(1011, 'try again');
      });
    });
  }

  private async hold(ws: WebSocket, ticket: string): Promise<void> {
    const early: EarlyFrame[] = [];
    const keep = (data: unknown, isBinary: boolean) => {
      if (early.length < MAX_EARLY_FRAMES) early.push({ data: data as Buffer, isBinary });
    };
    ws.on('message', keep);
    try {
      await this.options.redeem(ws, ticket, early);
    } finally {
      ws.off('message', keep);
      // An attachment took its own copy; on a refusal nothing did, and a slow
      // close handshake must not keep the frames alive.
      early.length = 0;
    }
  }

  private originAllowed(origin: string | undefined): boolean {
    // A non-browser client sends no Origin; the ticket is what authorises it.
    if (!origin) return true;
    const allowed = this.options.frontendUrl();
    if (!allowed) return false;
    try {
      return new URL(allowed).origin === new URL(origin).origin;
    } catch {
      return false;
    }
  }
}

/** A message on an established socket, if it is still open. */
export function tellSocket(ws: WebSocket, message: AttachServerMessage): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
}

/** A final answer: the reason as a control frame, then the code. */
export function endSocket(ws: WebSocket, reason: AttachClosedReason, code: number): void {
  tellSocket(ws, { type: 'closed', reason });
  ws.close(code, reason);
}
