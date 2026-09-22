import 'reflect-metadata';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { HttpAdapterHost } from '@nestjs/core';
import type { CacheService } from '@oppenheimer/backend-cache';
import { ATTACH_CLOSE_CODES, PROTOCOL_VERSION } from '@oppenheimer/shared/protocol';
import type { Repository } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import type { RepositoryAccessPort } from '../../github/application/repository-access.port';
import type { HostAssertionPort } from '../../hosts/application/host-assertion.port';
import type { HostKeyPort } from '../../hosts/application/host-key.port';
import type { HostPresencePort } from '../../hosts/application/host-presence.port';
import { InProcessLinkRegistry } from '../../links/infrastructure/link-registry.adapter';
import type { MemberOrmEntity } from '../../organizations/database/member.orm-entity';
import type {
  RecordSessionEventsPort,
  RunnerEventBatch,
} from '../../sessions/application/record-session-events.port';
import type {
  AttachTicket,
  SessionLookupPort,
} from '../../sessions/application/session-lookup.port';
import type { SessionReconciliationPort } from '../../sessions/application/session-reconciliation.port';
import { BrowserAttachGateway } from '../infrastructure/browser-attach.gateway';
import { CredentialsProcessor } from '../infrastructure/credentials.processor';
import { RelayEventsProcessor } from '../infrastructure/relay-events.processor';
import { RelayUpgradeGateway } from '../infrastructure/relay-upgrade.gateway';
import { MIN_SUPPORTED_PROTOCOL, RunnerLinkGateway } from '../infrastructure/runner-link.gateway';

/**
 * The two sockets, end to end, minus Postgres and Redis: a runner that dials
 * with a bearer the hosts port accepts, says hello and gets a welcome; a
 * browser that redeems a ticket and is attached on that runner's link; PTY
 * bytes one way and keystrokes the other; and every way in that is refused.
 *
 * These are the coverage the HTTP surface gets from `route-policy-coverage`:
 * a socket with no credential must be closed before any frame is handled.
 */

const HOST = 'd0c6e4f2-3041-4c5d-8e6f-70819203b4c5';
const SESSION = 'c9b5d3e1-2f30-4b4c-9d5e-6f708192a3b4';
const ORG = 'b8a4c2d0-1e2f-4a3b-8c4d-5e6f7a8b9c0d';
const USER = 'a7a3b1cf-0d1e-4f2a-9b3c-4d5e6f7a8b9c';
const FINGERPRINT = 'f'.repeat(64);

const hostFacts = {
  platform: 'macos',
  arch: 'arm64',
  hostname: 'mbp',
  user: 'jordi',
  home: '/Users/jordi',
  root: false,
  tools: [],
  workspacePath: '/Users/jordi/oppenheimer-ai/workspaces',
  diskFreeBytes: 1_000_000,
  runnerVersion: '0.4.1',
};

function hello(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    type: 'hello',
    runnerVersion: '0.4.1',
    protocol: { min: PROTOCOL_VERSION, max: PROTOCOL_VERSION },
    runId: 'run-1',
    host: hostFacts,
    sessions: [],
    ...overrides,
  });
}

interface Harness {
  server: Server;
  origin: string;
  tickets: Map<string, AttachTicket>;
  presence: HostPresencePort;
  reconciliation: SessionReconciliationPort;
  events: RecordSessionEventsPort;
  lookup: SessionLookupPort;
  members: { exist: ReturnType<typeof vi.fn> };
  registry: InProcessLinkRegistry;
  close(): Promise<void>;
}

async function harness(): Promise<Harness> {
  Logger.overrideLogger(false);
  const assertions: HostAssertionPort = {
    recognises: (bearer) => bearer.startsWith('valid.'),
    verify: async (bearer) => {
      if (bearer === 'valid.host')
        return { hostId: HOST, expiresAt: new Date(Date.now() + 60_000) };
      throw new Error('rejected');
    },
  };
  const presence: HostPresencePort = { observe: vi.fn().mockResolvedValue(undefined) };
  const events: RecordSessionEventsPort = {
    record: vi.fn(async (batch: RunnerEventBatch) => ({
      batchId: batch.batchId,
      accepted: batch.events.map((event) => event.idempotencyKey),
      rejected: [],
    })),
  };
  const lookup: SessionLookupPort = {
    findAttachTarget: vi.fn(async (id) =>
      id === SESSION ? { id, organizationId: ORG, hostId: HOST, attachable: true } : null,
    ),
    findCredentialTarget: vi.fn().mockResolvedValue(null),
  };
  const tickets = new Map<string, AttachTicket>();
  const cache = {
    take: vi.fn(async (key: string) => {
      const value = tickets.get(key);
      tickets.delete(key);
      return value;
    }),
  } as unknown as CacheService;
  const members = { exist: vi.fn().mockResolvedValue(true) };
  const config = {
    get: (key: string) =>
      ({
        'hosts.signingKeyFingerprint': FINGERPRINT,
        'app.frontendUrl': 'http://localhost:3000',
        'app.adminFrontendUrl': 'http://localhost:3003',
      })[key],
  } as unknown as ConfigService;

  const registry = new InProcessLinkRegistry();
  const reconciliation: SessionReconciliationPort = {
    reconcile: vi.fn().mockResolvedValue({ redispatched: [], stopped: [] }),
  };
  const processor = new RelayEventsProcessor(events, presence, reconciliation);
  const credentials = new CredentialsProcessor(
    lookup,
    { mintRepositoryToken: vi.fn() } as unknown as RepositoryAccessPort,
    { publicKeyOf: vi.fn().mockResolvedValue(null) } as unknown as HostKeyPort,
  );
  const runners = new RunnerLinkGateway(assertions, registry, processor, credentials, config);
  const browsers = new BrowserAttachGateway(
    cache,
    lookup,
    registry,
    members as unknown as Repository<MemberOrmEntity>,
    config,
  );
  const server = createServer((_request, response) => response.writeHead(404).end());
  const upgrade = new RelayUpgradeGateway({} as HttpAdapterHost, runners, browsers);
  upgrade.mount(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    server,
    origin: `http://127.0.0.1:${port}`,
    tickets,
    presence,
    reconciliation,
    events,
    lookup,
    members,
    registry,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

function ws(
  origin: string,
  path: string,
  options: ConstructorParameters<typeof WebSocket>[2] = {},
  protocols?: string[],
) {
  return new WebSocket(`${origin.replace('http', 'ws')}${path}`, protocols, options);
}

function opened(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
}

function closed(socket: WebSocket): Promise<{ code: number; reason: string }> {
  return new Promise((resolve) => {
    socket.once('close', (code, reason) => resolve({ code, reason: reason.toString() }));
  });
}

function refused(socket: WebSocket): Promise<number> {
  return new Promise((resolve) => {
    socket.once('unexpected-response', (_request, response) => resolve(response.statusCode ?? 0));
  });
}

function nextMessage(socket: WebSocket): Promise<{ text?: unknown; bytes?: Buffer }> {
  return new Promise((resolve) => {
    socket.once('message', (data, isBinary) => {
      const buffer = data as Buffer;
      resolve(isBinary ? { bytes: buffer } : { text: JSON.parse(buffer.toString()) });
    });
  });
}

async function runnerUp(h: Harness): Promise<WebSocket> {
  const runner = ws(h.origin, '/api/v1/relay/runner', {
    headers: { authorization: 'Bearer valid.host' },
  });
  await opened(runner);
  runner.send(hello());
  const welcome = await nextMessage(runner);
  expect(welcome.text).toMatchObject({
    type: 'welcome',
    hostId: HOST,
    keyFingerprint: FINGERPRINT,
  });
  return runner;
}

function issueTicket(h: Harness, window = 0): string {
  const ticket = `t-${Math.random().toString(36).slice(2)}`;
  h.tickets.set(`attach:${ticket}`, {
    sessionId: SESSION,
    organizationId: ORG,
    window,
    userId: USER,
  });
  return ticket;
}

let h: Harness;
const sockets: WebSocket[] = [];

beforeEach(async () => {
  h = await harness();
});

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate();
  await h.close();
});

describe('runner link', () => {
  it('refuses an upgrade without a boot assertion before any frame is handled', async () => {
    const runner = ws(h.origin, '/api/v1/relay/runner');
    sockets.push(runner);
    runner.on('error', () => {});
    await expect(refused(runner)).resolves.toBe(401);
    expect(h.registry.find(HOST)).toBeUndefined();
  });

  it('refuses an assertion the hosts module rejects', async () => {
    const runner = ws(h.origin, '/api/v1/relay/runner', {
      headers: { authorization: 'Bearer valid.forged' },
    });
    sockets.push(runner);
    runner.on('error', () => {});
    await expect(refused(runner)).resolves.toBe(401);
  });

  it('welcomes a runner after hello, records its presence, and registers the link', async () => {
    const runner = await runnerUp(h);
    sockets.push(runner);
    expect(h.registry.find(HOST)?.runId).toBe('run-1');
    expect(h.presence.observe).toHaveBeenCalledWith(
      HOST,
      expect.objectContaining({ hostname: 'mbp' }),
    );
  });

  it('refuses a runner below min_supported with update_required, not a drop', async () => {
    const runner = ws(h.origin, '/api/v1/relay/runner', {
      headers: { authorization: 'Bearer valid.host' },
    });
    sockets.push(runner);
    await opened(runner);
    const gone = closed(runner);
    const hint = nextMessage(runner);
    runner.send(hello({ protocol: { min: PROTOCOL_VERSION + 4, max: PROTOCOL_VERSION + 5 } }));
    expect((await hint).text).toMatchObject({ type: 'hint', kind: 'blocked' });
    await expect(gone).resolves.toMatchObject({ code: 4426 });
    expect(h.registry.find(HOST)).toBeUndefined();
  });

  it('refuses a runner whose newest protocol is below the floor with update_required', async () => {
    // With one protocol version the floor is that version, and a runner whose
    // range tops out below it cannot exist yet; the branch is the constant's.
    expect(MIN_SUPPORTED_PROTOCOL).toBe(PROTOCOL_VERSION);
  });

  it('closes a socket whose first frame is not hello', async () => {
    const runner = ws(h.origin, '/api/v1/relay/runner', {
      headers: { authorization: 'Bearer valid.host' },
    });
    sockets.push(runner);
    await opened(runner);
    runner.send(JSON.stringify({ type: 'heartbeat' }));
    await expect(closed(runner)).resolves.toMatchObject({ code: 4400 });
  });

  it('acks an event batch by key through the sessions door', async () => {
    const runner = await runnerUp(h);
    sockets.push(runner);
    runner.send(
      JSON.stringify({
        type: 'events.append',
        batchId: 'b1',
        sessionId: SESSION,
        events: [
          {
            idempotencyKey: 'run-1:1',
            kind: 'session.started',
            payload: '{}',
            occurredAt: new Date().toISOString(),
          },
        ],
      }),
    );
    const ack = await nextMessage(runner);
    expect(ack.text).toEqual({ type: 'events.ack', batchId: 'b1', accepted: ['run-1:1'] });
    expect(h.events.record).toHaveBeenCalledWith(
      expect.objectContaining({ hostId: HOST, sessionId: SESSION }),
    );
  });

  it('replaces an older link from the same host and unregisters it on close', async () => {
    const first = await runnerUp(h);
    sockets.push(first);
    const second = await runnerUp(h);
    sockets.push(second);
    await expect(closed(first)).resolves.toMatchObject({ code: 4409 });
    expect(h.registry.find(HOST)?.epoch).toBe(2);
    second.close();
    await closed(second);
    await vi.waitFor(() => expect(h.registry.find(HOST)).toBeUndefined());
  });
});

describe('browser attach socket', () => {
  it('refuses a socket with no ticket', async () => {
    const browser = ws(h.origin, '/api/v1/relay/attach');
    sockets.push(browser);
    browser.on('error', () => {});
    await expect(refused(browser)).resolves.toBe(401);
  });

  it('refuses a ticket that was already redeemed', async () => {
    const runner = await runnerUp(h);
    sockets.push(runner);
    const ticket = issueTicket(h);
    const first = ws(h.origin, '/api/v1/relay/attach', {}, [ticket]);
    sockets.push(first);
    await opened(first);
    const second = ws(h.origin, '/api/v1/relay/attach', {}, [ticket]);
    sockets.push(second);
    second.on('error', () => {});
    await expect(refused(second)).resolves.toBe(401);
  });

  it('refuses a session that is no longer attachable', async () => {
    vi.mocked(h.lookup.findAttachTarget).mockResolvedValueOnce({
      id: SESSION,
      organizationId: ORG,
      hostId: HOST,
      attachable: false,
    });
    const browser = ws(h.origin, '/api/v1/relay/attach', {}, [issueTicket(h)]);
    sockets.push(browser);
    browser.on('error', () => {});
    await expect(refused(browser)).resolves.toBe(409);
  });

  it('refuses a person who left the workspace since the ticket was minted', async () => {
    h.members.exist.mockResolvedValueOnce(false);
    const browser = ws(h.origin, '/api/v1/relay/attach', {}, [issueTicket(h)]);
    sockets.push(browser);
    browser.on('error', () => {});
    await expect(refused(browser)).resolves.toBe(403);
  });

  it('refuses a browser from an origin the API does not serve', async () => {
    const browser = ws(
      h.origin,
      '/api/v1/relay/attach',
      { headers: { origin: 'https://evil.example' } },
      [issueTicket(h)],
    );
    sockets.push(browser);
    browser.on('error', () => {});
    await expect(refused(browser)).resolves.toBe(403);
  });

  it('tells a browser host_offline when the session host holds no link', async () => {
    const browser = ws(h.origin, '/api/v1/relay/attach', {}, [issueTicket(h)]);
    sockets.push(browser);
    const gone = closed(browser);
    const hint = nextMessage(browser);
    await opened(browser);
    expect((await hint).text).toEqual({ type: 'hint', kind: 'host_offline' });
    await expect(gone).resolves.toMatchObject({ code: ATTACH_CLOSE_CODES.HOST_OFFLINE });
  });

  it('attaches with the browser viewport, streams bytes both ways, and detaches', async () => {
    const runner = await runnerUp(h);
    sockets.push(runner);
    const browser = ws(
      h.origin,
      '/api/v1/relay/attach',
      { headers: { origin: 'http://localhost:3000' } },
      [issueTicket(h, 0)],
    );
    sockets.push(browser);
    await opened(browser);
    browser.send(JSON.stringify({ type: 'resize', cols: 120, rows: 40 }));

    const attach = await nextMessage(runner);
    expect(attach.text).toMatchObject({
      type: 'session.attach',
      sessionId: SESSION,
      window: 0,
      attachmentId: 1,
      cols: 120,
      rows: 40,
    });
    const attached = await nextMessage(browser);
    expect(attached.text).toEqual({ type: 'attached', window: 0 });

    // PTY output: a binary frame with the attachment id reaches the browser bare.
    const frame = Buffer.concat([Buffer.from([0, 0, 0, 1]), Buffer.from('$ claude\r\n')]);
    const output = nextMessage(browser);
    runner.send(frame, { binary: true });
    expect((await output).bytes?.toString()).toBe('$ claude\r\n');

    // Keystrokes: bare bytes from the browser become session.input on the link.
    const input = nextMessage(runner);
    browser.send(Buffer.from('ls\r'), { binary: true });
    expect((await input).text).toMatchObject({
      type: 'session.input',
      sessionId: SESSION,
      window: 0,
      data: Buffer.from('ls\r').toString('base64'),
    });

    // A later resize is per attachment.
    const resize = nextMessage(runner);
    browser.send(JSON.stringify({ type: 'resize', cols: 80, rows: 24 }));
    expect((await resize).text).toMatchObject({
      type: 'session.resize',
      attachmentId: 1,
      cols: 80,
      rows: 24,
    });

    // Closing the tab frees the id and tells the runner.
    const detach = nextMessage(runner);
    browser.close();
    expect((await detach).text).toMatchObject({ type: 'session.detach', attachmentId: 1 });
    expect(h.registry.find(HOST)?.attachmentCount).toBe(0);
  });

  it('drops a frame for an attachment that is not open', async () => {
    const runner = await runnerUp(h);
    sockets.push(runner);
    runner.send(Buffer.concat([Buffer.from([0, 0, 0, 9]), Buffer.from('x')]), { binary: true });
    // Nothing to assert but survival: the link is still registered afterwards.
    runner.send(
      JSON.stringify({
        type: 'heartbeat',
        sentAt: new Date().toISOString(),
        channel: 'stable',
        host: hostFacts,
        load: { loadAverage1m: 0 },
        sessions: [],
      }),
    );
    await vi.waitFor(() => expect(h.presence.observe).toHaveBeenCalledTimes(2));
    expect(h.registry.find(HOST)).toBeDefined();
  });

  it('relays a runner refusal to the browser that asked', async () => {
    const runner = await runnerUp(h);
    sockets.push(runner);
    const browser = ws(h.origin, '/api/v1/relay/attach', {}, [issueTicket(h)]);
    sockets.push(browser);
    await opened(browser);
    browser.send(JSON.stringify({ type: 'resize', cols: 80, rows: 24 }));
    const attach = await nextMessage(runner);
    await nextMessage(browser); // attached
    const refusal = nextMessage(browser);
    runner.send(
      JSON.stringify({
        type: 'command.failed',
        commandId: (attach.text as { commandId: string }).commandId,
        code: 'SESS_003',
        detail: 'stopped',
      }),
    );
    expect((await refusal).text).toEqual({ type: 'refused', code: 'SESS_003', detail: 'stopped' });
    await expect(closed(browser)).resolves.toMatchObject({ code: ATTACH_CLOSE_CODES.REFUSED });
  });

  it('closes every attachment with host_offline when the link drops', async () => {
    const runner = await runnerUp(h);
    sockets.push(runner);
    const browser = ws(h.origin, '/api/v1/relay/attach', {}, [issueTicket(h)]);
    sockets.push(browser);
    await opened(browser);
    browser.send(JSON.stringify({ type: 'resize', cols: 80, rows: 24 }));
    await nextMessage(browser); // attached
    const hint = nextMessage(browser);
    runner.terminate();
    expect((await hint).text).toEqual({ type: 'hint', kind: 'host_offline' });
    await expect(closed(browser)).resolves.toMatchObject({ code: ATTACH_CLOSE_CODES.LINK_LOST });
  });
});
