/**
 * Sessions' previews through the relay, end to end inside one process: the
 * preview proxy's own HTTP server, a runner link
 * faked as a bridge that opens each port attachment as a real TCP connection,
 * and a real app behind that (`product/versions/mvp/28-session-previews.md`).
 *
 * What it holds: only a redeemed ticket gets a reader in; the app sees
 * `localhost:<port>` and never the preview's own cookie; a redirect to
 * localhost comes back on the preview; only the console may frame it; a
 * WebSocket (a dev server's hot reload) passes; and a host that is not a
 * preview gets nothing. The runner's half is `link_ports_test.go`.
 */
import { createServer, type IncomingMessage, request, type Server } from 'node:http';
import { connect, type Socket } from 'node:net';
import type { ConfigService } from '@nestjs/config';
import type { CacheService } from '@oppenheimer/backend-cache';
import type { ProtocolMessage } from '@oppenheimer/shared/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import type { FlagEvaluatorPort } from '../../feature-flags/application/flag-evaluator.port';
import type {
  AttachmentSink,
  LinkRegistryPort,
  RunnerLink,
} from '../../links/application/link-registry.port';
import type { AttachTicket } from '../../sessions/application/session-lookup.port';
import { previewOrigin } from '../../sessions/domain/session-preview.policy';
import type { BrowserAttachGateway } from '../infrastructure/browser-attach.gateway';
import { PreviewProxyGateway } from '../infrastructure/preview-proxy.gateway';

const BASE = 'http://preview.localhost:3011';
const CONSOLE = 'http://localhost:3000';
const SESSION = '3f0d9e2c-6a4b-4e9a-9c3d-7b1e5a2f8c40';

/** A link whose port attachments are real TCP connections to this machine. */
function bridgeLink(): RunnerLink & { opened: number } {
  const sinks = new Map<number, AttachmentSink>();
  const sockets = new Map<number, Socket>();
  let next = 1;
  const link = {
    hostId: 'host-1',
    runId: 'run-1',
    epoch: 1,
    capabilities: ['port.forward'],
    attachmentCount: 0,
    opened: 0,
    send(message: ProtocolMessage): boolean {
      if (message.type === 'port.open') {
        link.opened += 1;
        const socket = connect(message.port, '127.0.0.1');
        sockets.set(message.attachmentId, socket);
        socket.on('connect', () => sinks.get(message.attachmentId)?.opened?.());
        socket.on('data', (bytes) => sinks.get(message.attachmentId)?.deliver(bytes));
        socket.on('close', () => sinks.get(message.attachmentId)?.closed('runner_closed'));
      }
      if (message.type === 'port.close') sockets.get(message.attachmentId)?.destroy();
      return true;
    },
    sendBinary(attachmentId: number, bytes: Uint8Array): boolean {
      sockets.get(attachmentId)?.write(bytes);
      sinks.get(attachmentId)?.credit?.(bytes.length);
      return true;
    },
    openAttachment(sink: AttachmentSink): number {
      const id = next++;
      sinks.set(id, sink);
      return id;
    },
    closeAttachment(attachmentId: number): void {
      sinks.delete(attachmentId);
    },
    attachment: (attachmentId: number) => sinks.get(attachmentId),
    takeSessionCommand: () => undefined,
    close: () => {},
  };
  return link;
}

/** What a request to the server came back with. */
interface Answer {
  status: number;
  headers: IncomingMessage['headers'];
  body: string;
}

function ask(
  port: number,
  host: string,
  path: string,
  headers: Record<string, string> = {},
): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, headers: { host, ...headers } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('preview proxy', () => {
  let app: Server;
  let appPort: number;
  let wss: WebSocketServer;
  let api: Server;
  let apiPort: number;
  let previewHost: string;
  let seen: IncomingMessage[];
  let tickets: Map<string, AttachTicket>;
  let link: ReturnType<typeof bridgeLink>;
  /** Whether the reader is still allowed, as the attach rule would answer now. */
  let allowed: boolean;
  let gateway: PreviewProxyGateway;

  beforeEach(async () => {
    seen = [];
    // The session's dev server: echoes what it was sent, redirects /login.
    app = createServer((req, res) => {
      seen.push(req);
      if (req.url === '/login') {
        res.writeHead(302, {
          location: `http://localhost:${appPort}/home`,
          'x-frame-options': 'DENY',
        });
        res.end();
        return;
      }
      res.writeHead(200, {
        'content-type': 'application/json',
        'set-cookie': 'sid=1; Domain=localhost; Path=/',
      });
      res.end(
        JSON.stringify({
          host: req.headers.host,
          cookie: req.headers.cookie ?? null,
          origin: req.headers.origin ?? null,
        }),
      );
    });
    wss = new WebSocketServer({ server: app });
    wss.on('connection', (ws) => ws.on('message', (data) => ws.send(`hmr:${data}`)));
    await new Promise<void>((resolve) => app.listen(0, '127.0.0.1', resolve));
    appPort = (app.address() as { port: number }).port;
    previewHost = new URL(previewOrigin(BASE, { sessionId: SESSION, port: appPort })).host;

    tickets = new Map();
    allowed = true;
    link = bridgeLink();
    const settings: Record<string, string> = {
      'relay.previewBaseUrl': BASE,
      'app.frontendUrl': CONSOLE,
      'app.betterAuthSecret': 'a-secret-for-the-preview-cookie',
    };
    gateway = new PreviewProxyGateway(
      { get: (key: string) => settings[key] } as unknown as ConfigService,
      {
        take: async (key: string) => {
          const claim = tickets.get(key.replace('attach:', ''));
          tickets.delete(key.replace('attach:', ''));
          return claim ?? null;
        },
      } as unknown as CacheService,
      { find: () => link } as unknown as LinkRegistryPort,
      { isEnabled: () => true } as unknown as FlagEvaluatorPort,
      {
        authorize: async () =>
          allowed
            ? { allowed: true, hostId: 'host-1' }
            : { allowed: false, reason: 'forbidden', code: 4403 },
      } as unknown as BrowserAttachGateway,
    );
    // Judged again every 50 ms here, rather than every minute.
    gateway.reauthorizeIntervalMs = 50;
    api = gateway.createServer();
    await new Promise<void>((resolve) => api.listen(0, '127.0.0.1', resolve));
    apiPort = (api.address() as { port: number }).port;
  });

  afterEach(async () => {
    wss.close();
    await new Promise((resolve) => api.close(resolve));
    await new Promise((resolve) => app.close(resolve));
  });

  function mint(port = appPort): string {
    const ticket = `t-${Math.random().toString(36).slice(2)}`;
    tickets.set(ticket, {
      sessionId: SESSION,
      organizationId: 'org-1',
      window: 0,
      userId: 'user-1',
      target: 'preview',
      port,
    });
    return ticket;
  }

  async function enter(): Promise<string> {
    const answer = await ask(
      apiPort,
      previewHost,
      `/__oppenheimer/enter?ticket=${mint()}&path=%2Fdocs&embed=1`,
    );
    expect(answer.status).toBe(302);
    expect(answer.headers.location).toBe('/docs');
    const cookie = (answer.headers['set-cookie'] ?? [])[0] ?? '';
    // Partitioned under the console's site, so another site framing it carries none.
    expect(cookie).toMatch(/SameSite=None; Secure; Partitioned/);
    return cookie.split(';')[0] as string;
  }

  it('serves no reader who did not come through a ticket, and no ticket twice', async () => {
    expect((await ask(apiPort, previewHost, '/')).status).toBe(401);
    const ticket = mint();
    expect((await ask(apiPort, previewHost, `/__oppenheimer/enter?ticket=${ticket}`)).status).toBe(
      302,
    );
    expect((await ask(apiPort, previewHost, `/__oppenheimer/enter?ticket=${ticket}`)).status).toBe(
      401,
    );
    // A ticket for another port is not this origin's.
    const other = mint(appPort + 1);
    expect((await ask(apiPort, previewHost, `/__oppenheimer/enter?ticket=${other}`)).status).toBe(
      401,
    );
    expect(link.opened).toBe(0);
  });

  it('shows the app localhost, never the preview cookie, and keeps its own cookies', async () => {
    const cookie = await enter();
    const answer = await ask(apiPort, previewHost, '/docs', {
      cookie: `${cookie}; theme=dark`,
      origin: `http://${previewHost}`,
      'x-forwarded-host': 'evil.test',
    });
    expect(answer.status).toBe(200);
    expect(JSON.parse(answer.body)).toEqual({
      host: `localhost:${appPort}`,
      cookie: 'theme=dark',
      origin: `http://localhost:${appPort}`,
    });
    expect(seen[0]?.headers['x-forwarded-host']).toBeUndefined();
    // Its cookie no longer names localhost, and is partitioned: kept inside
    // the console's frame on another site, and sent nowhere else.
    expect(answer.headers['set-cookie']).toEqual([
      'sid=1; Path=/; SameSite=None; Secure; Partitioned',
    ]);
    expect(answer.headers['content-security-policy']).toBe(`frame-ancestors ${CONSOLE}`);
  });

  it('brings a redirect to localhost back to the preview, framable by the console alone', async () => {
    const cookie = await enter();
    const answer = await ask(apiPort, previewHost, '/login', { cookie });
    expect(answer.status).toBe(302);
    expect(answer.headers.location).toBe(`http://${previewHost}/home`);
    expect(answer.headers['x-frame-options']).toBeUndefined();
    expect(answer.headers['content-security-policy']).toBe(`frame-ancestors ${CONSOLE}`);
  });

  it('passes a WebSocket, as a dev server’s hot reload uses', async () => {
    const cookie = await enter();
    const ws = new WebSocket(`ws://127.0.0.1:${apiPort}/`, {
      headers: { host: previewHost, cookie },
    });
    const reply = await new Promise<string>((resolve, reject) => {
      ws.on('open', () => ws.send('update'));
      ws.on('message', (data) => resolve(String(data)));
      ws.on('error', reject);
    });
    expect(reply).toBe('hmr:update');
    ws.close();
  });

  it('ends an open WebSocket once its reader is no longer allowed', async () => {
    const cookie = await enter();
    const ws = new WebSocket(`ws://127.0.0.1:${apiPort}/`, {
      headers: { host: previewHost, cookie },
    });
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
    });

    allowed = false;
    const closed = await new Promise<boolean>((resolve) => {
      ws.on('close', () => resolve(true));
      setTimeout(() => resolve(false), 2_000);
    });
    expect(closed).toBe(true);
  });

  it('answers no host that is not a preview, and opens nothing for one', async () => {
    const answer = await ask(apiPort, 'localhost:3001', '/api/auth/session');
    expect(answer.status).toBe(404);
    expect(link.opened).toBe(0);
  });
});
