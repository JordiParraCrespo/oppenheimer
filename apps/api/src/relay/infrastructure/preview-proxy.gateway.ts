import {
  Agent,
  createServer,
  type IncomingMessage,
  request,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { Duplex } from 'node:stream';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@oppenheimer/backend-cache';
import type { FlagEvaluatorPort } from '../../feature-flags/application/flag-evaluator.port';
import { FLAG_EVALUATOR } from '../../feature-flags/feature-flags.di-tokens';
import type { LinkRegistryPort, RunnerLink } from '../../links/application/link-registry.port';
import { LINK_REGISTRY } from '../../links/links.di-tokens';
import {
  ATTACH_TICKET_PREFIX,
  type AttachTicket,
} from '../../sessions/application/session-lookup.port';
import {
  PREVIEW_COOKIE,
  PREVIEW_ENTER_PATH,
  type PreviewAddress,
  previewAddressOf,
  previewOrigin,
  safePreviewPath,
} from '../../sessions/domain/session-preview.policy';
import { BoundedMap } from './bounded-map.util';
import { BrowserAttachGateway, REAUTHORIZE_INTERVAL_MS } from './browser-attach.gateway';
import { LinkPortStream, PortRefusedError } from './link-port-stream.util';
import {
  cookieValue,
  downstreamHeaders,
  PREVIEW_COOKIE_TTL_MS,
  type PreviewCookieClaim,
  previewCookieKey,
  previewSetCookie,
  signPreviewCookie,
  upstreamHeaders,
  verifyPreviewCookie,
} from './preview-http.util';
import { refuseUpgrade } from './upgrade.util';

/** Readers whose last judgement is remembered, so a page's hundred requests are judged once a minute. */
const MAX_JUDGED = 1_000;

/** Sessions' ports with an agent of kept-alive connections. */
const MAX_AGENTS = 1_000;

/** Idle connections kept per session's port: a page's next request reuses one rather than opening a port again. */
const MAX_SOCKETS_PER_PORT = 16;

type Judged = { at: number; verdict: Promise<{ allowed: boolean; hostId?: string }> };

/**
 * Sessions' previews (`product/versions/mvp/28-session-previews.md`): an HTTP
 * listener of their own on `PREVIEW_PORT`, apart from the API's, so a
 * preview's requests (its `/api/auth/...` included) never pass through Nest,
 * Better Auth or the API's middleware, and the API's request path knows
 * nothing of previews. Every request and upgrade whose `Host` is a preview
 * origin of this deployment is relayed to the session's port through its
 * host's runner; any other host is a 404.
 *
 * - **Who:** the origin redeems an attach ticket minted with the `preview`
 *   target at `/__oppenheimer/enter`, and keeps the reader in a signed cookie
 *   of its own. Every request is judged as an attachment is (the session
 *   live, the person still a member who may use its host, the flag on), at
 *   most once a minute per reader.
 * - **What:** a TCP connection per HTTP connection, a `LinkPortStream`, kept
 *   alive across requests by an agent per session's port; an upgrade is a
 *   stream of its own, piped raw.
 * - **As what:** the app sees `localhost:<port>` (`preview-http.util.ts`).
 *
 * Off (no `PREVIEW_BASE_URL`), it listens on nothing.
 */
@Injectable()
export class PreviewProxyGateway implements OnApplicationBootstrap, OnApplicationShutdown {
  /** `REAUTHORIZE_INTERVAL_MS`; a field only so a test can shorten it. */
  reauthorizeIntervalMs = REAUTHORIZE_INTERVAL_MS;
  private readonly logger = new Logger(PreviewProxyGateway.name);
  private readonly judged = new BoundedMap<string, Judged>(MAX_JUDGED);
  private readonly agents = new BoundedMap<string, Agent>(MAX_AGENTS, (agent) => agent.destroy());
  private server: Server | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    @Inject(LINK_REGISTRY)
    private readonly links: LinkRegistryPort,
    @Inject(FLAG_EVALUATOR)
    private readonly flags: FlagEvaluatorPort,
    private readonly attach: BrowserAttachGateway,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.base) return;
    const port = this.config.get<number>('relay.previewPort') ?? 3011;
    this.server = this.createServer();
    // A port already taken leaves previews off rather than taking the API down.
    this.server.on('error', (error) => {
      this.logger.error({ message: 'previews could not listen', port, error: String(error) });
    });
    this.server.listen(port, () => this.logger.log({ message: 'previews listening', port }));
  }

  onApplicationShutdown(): void {
    this.server?.close();
    for (const agent of this.agents.values()) agent.destroy();
  }

  /** The previews' server: every preview origin's requests and upgrades, and a 404 for any other host. */
  createServer(): Server {
    const server = createServer((req, res) => {
      const address = this.addressOf(req);
      if (!address) {
        page(res, 404, 'Not a preview of this deployment.');
        return;
      }
      this.serve(req, res, address).catch((error: unknown) => {
        this.logger.error({ message: 'preview request failed', error: String(error) });
        if (!res.headersSent) page(res, 502, 'The preview could not be served. Try again.');
        else res.destroy();
      });
    });
    server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      // Node drops its own error listener on an upgraded socket; a reset while
      // the reader is judged must not take the process down.
      socket.on('error', () => socket.destroy());
      const address = this.addressOf(req);
      if (!address) {
        refuseUpgrade(socket, 404, 'not a preview of this deployment');
        return;
      }
      this.handleUpgrade(req, socket, head, address).catch(() =>
        refuseUpgrade(socket, 502, 'try again'),
      );
    });
    return server;
  }

  /** The preview a request is for, or null when its host is not one. */
  private addressOf(req: IncomingMessage): PreviewAddress | null {
    const base = this.base;
    return base ? previewAddressOf(base, req.headers.host) : null;
  }

  private async handleUpgrade(
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    address: PreviewAddress,
  ): Promise<void> {
    const reader = await this.reader(req, address);
    if (!reader) {
      refuseUpgrade(socket, 401, 'open this preview from the console');
      return;
    }
    const stream = new LinkPortStream(reader.link, address.sessionId, address.port);
    const origin = this.originOf(address);
    const headers = upstreamHeaders(req.headers, {
      previewOrigin: origin,
      port: address.port,
      upgrade: true,
    });
    const lines = [`${req.method ?? 'GET'} ${req.url ?? '/'} HTTP/1.1`];
    for (const [name, value] of Object.entries(headers)) {
      for (const one of Array.isArray(value) ? value : [value]) lines.push(`${name}: ${one}`);
    }
    stream.write(`${lines.join('\r\n')}\r\n\r\n`);
    if (head.length > 0) stream.write(head);
    // An upgraded socket outlives its handshake: judged again on the
    // interval an attach is, so a revoked grant, a ban or the flag going off
    // ends it as it ends a terminal. A lookup that fails keeps it.
    const recheck = setInterval(() => {
      this.reader(req, address).then(
        (still) => {
          if (!still) socket.destroy();
        },
        () => {},
      );
    }, this.reauthorizeIntervalMs);
    recheck.unref();
    stream.on('error', () => socket.destroy());
    socket.on('error', () => stream.destroy());
    socket.on('close', () => {
      clearInterval(recheck);
      stream.destroy();
    });
    stream.on('close', () => socket.destroy());
    stream.pipe(socket);
    socket.pipe(stream);
  }

  private async serve(
    req: IncomingMessage,
    res: ServerResponse,
    address: PreviewAddress,
  ): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://preview.invalid');
    if (url.pathname === PREVIEW_ENTER_PATH) {
      await this.enter(req, res, url, address);
      return;
    }
    const reader = await this.reader(req, address);
    if (!reader) {
      page(res, 401, 'This preview opens from its session in the console.');
      return;
    }
    const origin = this.originOf(address);
    const upstream = request({
      agent: this.agentFor(reader.link, address),
      method: req.method,
      path: req.url,
      headers: upstreamHeaders(req.headers, {
        previewOrigin: origin,
        port: address.port,
        upgrade: false,
      }),
    });
    upstream.on('response', (answer) => {
      res.writeHead(
        answer.statusCode ?? 502,
        answer.statusMessage,
        downstreamHeaders(answer.headers, {
          previewOrigin: origin,
          port: address.port,
          consoleOrigin: this.consoleOrigin,
          partitionCookies: this.secureCookies,
        }),
      );
      answer.pipe(res);
    });
    upstream.on('error', (error) => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      if (error instanceof PortRefusedError && error.code === 'PORT_001') {
        page(res, 502, `Nothing in this session listens on port ${address.port}.`);
        return;
      }
      page(res, 502, `Nothing answered on port ${address.port} in this session.`);
    });
    res.on('close', () => {
      if (!res.writableFinished) upstream.destroy();
    });
    req.pipe(upstream);
  }

  /** Redeem a ticket: set the reader's cookie and go to the app. */
  private async enter(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
    address: PreviewAddress,
  ): Promise<void> {
    const ticket = url.searchParams.get('ticket');
    const claim = ticket
      ? await this.cache.take<AttachTicket>(`${ATTACH_TICKET_PREFIX}${ticket}`)
      : null;
    if (
      !claim ||
      claim.target !== 'preview' ||
      claim.sessionId !== address.sessionId ||
      claim.port !== address.port
    ) {
      page(
        res,
        401,
        'This preview link has been used or has expired. Open it again from the console.',
      );
      return;
    }
    const verdict = await this.attach.authorize(claim);
    if (!verdict.allowed || !this.flagOn(claim)) {
      page(res, 403, 'You cannot open this preview.');
      return;
    }
    const cookie = signPreviewCookie(this.cookieKey, {
      sessionId: claim.sessionId,
      port: address.port,
      userId: claim.userId,
      organizationId: claim.organizationId,
      expiresAt: Date.now() + PREVIEW_COOKIE_TTL_MS,
    });
    const embed =
      req.headers['sec-fetch-dest'] === 'iframe' || url.searchParams.get('embed') === '1';
    res.writeHead(302, {
      location: safePreviewPath(url.searchParams.get('path')),
      'set-cookie': previewSetCookie(cookie, { embed, secure: this.secureCookies }),
      'cache-control': 'no-store',
      // The ticket was in this URL; it goes no further.
      'referrer-policy': 'no-referrer',
    });
    res.end();
  }

  /** The reader a request's cookie names, judged within the last minute, with the link to serve on. */
  private async reader(
    req: IncomingMessage,
    address: PreviewAddress,
  ): Promise<{ claim: PreviewCookieClaim; link: RunnerLink } | null> {
    const value = cookieValue(req.headers.cookie, PREVIEW_COOKIE);
    const claim = verifyPreviewCookie(this.cookieKey, value, Date.now());
    if (!claim || !value || claim.sessionId !== address.sessionId || claim.port !== address.port) {
      return null;
    }
    const verdict = await this.judge(value, claim);
    if (!verdict.allowed || !verdict.hostId) return null;
    const link = this.links.find(verdict.hostId);
    if (!link?.capabilities.includes('port.forward')) return null;
    return { claim, link };
  }

  private judge(key: string, claim: PreviewCookieClaim): Judged['verdict'] {
    const now = Date.now();
    const known = this.judged.get(key);
    if (known && now - known.at < this.reauthorizeIntervalMs) return known.verdict;
    const ticket: AttachTicket = {
      sessionId: claim.sessionId,
      organizationId: claim.organizationId,
      window: 0,
      userId: claim.userId,
      target: 'preview',
      port: claim.port,
    };
    const verdict = this.attach
      .authorize(ticket)
      .then((answer) =>
        answer.allowed && this.flagOn(ticket)
          ? { allowed: true, hostId: answer.hostId }
          : { allowed: false },
      );
    // A lookup that failed is asked again on the next request, not remembered.
    verdict.catch(() => this.judged.delete(key));
    this.judged.set(key, { at: now, verdict });
    return verdict;
  }

  /**
   * One keep-alive agent per session's port and link: a page's requests share
   * a few connections to the port instead of each opening one.
   */
  private agentFor(link: RunnerLink, address: PreviewAddress): Agent {
    const key = `${link.hostId}:${link.epoch}:${address.sessionId}:${address.port}`;
    let agent = this.agents.get(key);
    if (!agent) {
      agent = new PortAgent(link, address);
      this.agents.set(key, agent);
    }
    return agent;
  }

  private flagOn(claim: AttachTicket): boolean {
    return this.flags.isEnabled('session_browser_preview', {
      userId: claim.userId,
      organizationId: claim.organizationId,
    });
  }

  private originOf(address: PreviewAddress): string {
    return previewOrigin(this.base as string, address);
  }

  private get base(): string | undefined {
    return this.config.get<string>('relay.previewBaseUrl');
  }

  private get consoleOrigin(): string {
    return new URL(this.config.get<string>('app.frontendUrl') ?? 'http://localhost:3000').origin;
  }

  /** Whether the browser keeps a `Secure` cookie here: https, or a `localhost` name. */
  private get secureCookies(): boolean {
    const url = new URL(this.base as string);
    return (
      url.protocol === 'https:' ||
      url.hostname === 'localhost' ||
      url.hostname.endsWith('.localhost')
    );
  }

  private get cookieKey(): Buffer {
    return previewCookieKey(this.config.get<string>('app.betterAuthSecret') ?? '');
  }
}

/** An agent whose connections are port attachments on one link. */
class PortAgent extends Agent {
  constructor(
    private readonly link: RunnerLink,
    private readonly address: PreviewAddress,
  ) {
    super({ keepAlive: true, maxSockets: MAX_SOCKETS_PER_PORT, keepAliveMsecs: 30_000 });
  }

  override createConnection(): Duplex {
    return new LinkPortStream(this.link, this.address.sessionId, this.address.port);
  }
}

/** A plain page for what the preview origin says itself, never cached. */
function page(res: ServerResponse, status: number, text: string): void {
  res.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(`${text}\n`);
}
