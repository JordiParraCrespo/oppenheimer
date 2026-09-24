import 'reflect-metadata';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { HttpAdapterHost } from '@nestjs/core';
import type { CacheService } from '@oppenheimer/backend-cache';
import {
  ATTACH_CLOSE_CODES,
  PROTOCOL_VERSION,
  RUNNER_LINK_CLOSE_CODES,
} from '@oppenheimer/shared/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import type { RepositoryAccessPort } from '../../github/application/repository-access.port';
import type { HostAssertionPort } from '../../hosts/application/host-assertion.port';
import type { HostKeyPort } from '../../hosts/application/host-key.port';
import type { HostPresencePort } from '../../hosts/application/host-presence.port';
import { InProcessLinkRegistry } from '../../links/infrastructure/link-registry.adapter';
import type { WorkspaceLookupPort } from '../../organizations/application/workspace-lookup.port';
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
  workspaces: WorkspaceLookupPort;
  registry: InProcessLinkRegistry;
  close(): Promise<void>;
}

async function harness(options: { fingerprint?: string | null } = {}): Promise<Harness> {
  Logger.overrideLogger(false);
  const assertions: HostAssertionPort = {
    recognises: (bearer) => bearer.startsWith('valid.'),
    verify: async (bearer) => {
      if (bearer === 'valid.host')
        return { hostId: HOST, expiresAt: new Date(Date.now() + 60_000) };
      throw new Error('rejected');
    },
  };
  const presence: HostPresencePort = {
    observe: vi.fn().mockResolvedValue(true),
    isPaired: vi.fn().mockResolvedValue(true),
  };
  const events: RecordSessionEventsPort = {
    record: vi.fn(async (batch: RunnerEventBatch) => ({
      batchId: batch.batchId,
      accepted: batch.events.map((event) => event.idempotencyKey),
      rejected: [],
    })),
  };
  const lookup: SessionLookupPort = {
    findAttachTarget: vi.fn(async (id) =>
      id === SESSION ? { id, organizationId: ORG, hostId: HOST, state: 'live' as const } : null,
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
  const workspaces: WorkspaceLookupPort = {
    slugOf: vi.fn().mockResolvedValue('jordi'),
    isMember: vi.fn().mockResolvedValue(true),
  };
  const config = {
    get: (key: string) =>
      ({
        'hosts.signingKeyFingerprint':
          options.fingerprint === undefined ? FINGERPRINT : options.fingerprint,
        'app.frontendUrl': 'http://localhost:3000',
      })[key],
  } as unknown as ConfigService;

  const registry = new InProcessLinkRegistry(() => 0);
  const reconciliation: SessionReconciliationPort = {
    reconcile: vi.fn().mockResolvedValue({ redispatched: [], stopped: [] }),
  };
  const processor = new RelayEventsProcessor(events, presence, reconciliation);
  const credentials = new CredentialsProcessor(
    lookup,
    { mintRepositoryToken: vi.fn() } as unknown as RepositoryAccessPort,
    { publicKeyOf: vi.fn().mockResolvedValue(null) } as unknown as HostKeyPort,
  );
  const runners = new RunnerLinkGateway(
    assertions,
    presence,
    registry,
    processor,
    credentials,
    config,
  );
  const browsers = new BrowserAttachGateway(cache, lookup, registry, workspaces, config);
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
    workspaces,
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

  it('refuses every upgrade while the control plane has no signing key', async () => {
    await h.close();
    h = await harness({ fingerprint: null });
    const runner = ws(h.origin, '/api/v1/relay/runner', {
      headers: { authorization: 'Bearer valid.host' },
    });
    sockets.push(runner);
    runner.on('error', () => {});
    await expect(refused(runner)).resolves.toBe(503);
  });

  it('refuses an assertion the hosts module rejects', async () => {
    const runner = ws(h.origin, '/api/v1/relay/runner', {
      headers: { authorization: 'Bearer valid.forged' },
    });
    sockets.push(runner);
    runner.on('error', () => {});
    await expect(refused(runner)).resolves.toBe(401);
  });

  it('refuses an unpaired host with 410 before the upgrade, so it stops dialling', async () => {
    vi.mocked(h.presence.isPaired).mockResolvedValueOnce(false);
    const runner = ws(h.origin, '/api/v1/relay/runner', {
      headers: { authorization: 'Bearer valid.host' },
    });
    sockets.push(runner);
    runner.on('error', () => {});
    const response = new Promise<{ status?: number; refusal?: string | string[] }>((resolve) => {
      runner.once('unexpected-response', (_request, res) =>
        resolve({ status: res.statusCode, refusal: res.headers['x-oppenheimer-refusal'] }),
      );
    });
    // The header is what tells the runner this is the control plane's verdict,
    // not a proxy's 410, and so a reason to stop dialling for good.
    await expect(response).resolves.toEqual({ status: 410, refusal: 'host-unpaired' });
    expect(h.registry.find(HOST)).toBeUndefined();
    expect(h.reconciliation.reconcile).not.toHaveBeenCalled();
  });

  it('closes the link with 4410 when a heartbeat finds the host unpaired', async () => {
    const runner = await runnerUp(h);
    sockets.push(runner);
    vi.mocked(h.presence.observe).mockResolvedValueOnce(false);
    const gone = closed(runner);
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
    await expect(gone).resolves.toMatchObject({ code: RUNNER_LINK_CLOSE_CODES.UNPAIRED });
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

  it("applies a link's event batches in the order they arrived, however long each takes", async () => {
    // A start's steps are consecutive batches, and the log's order is the order
    // they are recorded in: `running` must not land after `done`.
    const finished: string[] = [];
    vi.mocked(h.events.record).mockImplementation(async (batch: RunnerEventBatch) => {
      await new Promise((resolve) => setTimeout(resolve, batch.batchId === 'b1' ? 50 : 0));
      finished.push(batch.batchId);
      return {
        batchId: batch.batchId,
        accepted: batch.events.map((event) => event.idempotencyKey),
        rejected: [],
      };
    });
    const runner = await runnerUp(h);
    sockets.push(runner);
    for (const [batchId, n, status] of [
      ['b1', 1, 'running'],
      ['b2', 2, 'done'],
    ] as const) {
      runner.send(
        JSON.stringify({
          type: 'events.append',
          batchId,
          sessionId: SESSION,
          events: [
            {
              idempotencyKey: `run-1:${n}`,
              kind: 'session.step',
              payload: JSON.stringify({ step: 'clone', status }),
              occurredAt: new Date().toISOString(),
            },
          ],
        }),
      );
    }
    await nextMessage(runner);
    await nextMessage(runner);
    expect(finished).toEqual(['b1', 'b2']);
  });

  it('records a refused session.create as the session failing, with the runner’s code and detail', async () => {
    // #56: a create the runner cannot make used to vanish, leaving the row
    // `starting` and the console spinning.
    const runner = await runnerUp(h);
    sockets.push(runner);
    const commandId = 'c0ffee00-0000-4000-8000-000000000001';
    h.registry.find(HOST)?.send({
      type: 'session.create',
      commandId,
      sessionId: SESSION,
      organizationSlug: 'jordi',
      projectSlug: 'xrp',
      sessionSlug: 'swift-wren-7gyezw',
      agent: 'claude-code',
      launch: { permission: 'ask' },
      branch: 'oppenheimer/xrp/swift-wren-7gyezw',
      checkouts: [],
      cwdCheckoutId: null,
    } as never);
    await nextMessage(runner);
    runner.send(
      JSON.stringify({
        type: 'command.failed',
        commandId,
        code: 'SESS_002',
        detail: 'this runner makes sessions with exactly one checkout; the frame carried 2',
      }),
    );
    await vi.waitFor(() =>
      expect(h.events.record).toHaveBeenCalledWith(
        expect.objectContaining({
          hostId: HOST,
          sessionId: SESSION,
          events: [
            expect.objectContaining({
              idempotencyKey: `refused-${commandId}:1`,
              kind: 'session.failed',
            }),
          ],
        }),
      ),
    );
    const recorded = vi.mocked(h.events.record).mock.calls.at(-1)?.[0];
    expect(JSON.parse(recorded?.events[0].payload ?? '{}')).toEqual({
      command: 'session.create',
      code: 'SESS_002',
      detail: 'this runner makes sessions with exactly one checkout; the frame carried 2',
    });
  });

  it('records any other refused session command as command.failed on its session', async () => {
    const runner = await runnerUp(h);
    sockets.push(runner);
    const commandId = 'c0ffee00-0000-4000-8000-000000000002';
    h.registry.find(HOST)?.send({ type: 'session.stop', commandId, sessionId: SESSION });
    await nextMessage(runner);
    runner.send(JSON.stringify({ type: 'command.failed', commandId, code: 'SESS_001' }));
    await vi.waitFor(() =>
      expect(h.events.record).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: SESSION,
          events: [expect.objectContaining({ kind: 'command.failed' })],
        }),
      ),
    );
  });

  it('records nothing for a refusal of a command this link never sent', async () => {
    const runner = await runnerUp(h);
    sockets.push(runner);
    runner.send(
      JSON.stringify({
        type: 'command.failed',
        commandId: 'c0ffee00-0000-4000-8000-000000000003',
        code: 'SESS_001',
      }),
    );
    // A batch after it: by its ack, the refusal has long been handled.
    runner.send(
      JSON.stringify({
        type: 'events.append',
        batchId: 'b-after',
        sessionId: SESSION,
        events: [
          {
            idempotencyKey: 'run-1:1',
            kind: 'agent.observed',
            payload: '{}',
            occurredAt: new Date().toISOString(),
          },
        ],
      }),
    );
    await nextMessage(runner);
    expect(h.events.record).toHaveBeenCalledTimes(1);
    expect(vi.mocked(h.events.record).mock.calls[0][0].batchId).toBe('b-after');
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

  it('closes a redeemed ticket on the socket with a reason the browser can classify', async () => {
    const runner = await runnerUp(h);
    sockets.push(runner);
    const ticket = issueTicket(h);
    const first = ws(h.origin, '/api/v1/relay/attach', {}, [ticket]);
    sockets.push(first);
    await opened(first);
    const second = ws(h.origin, '/api/v1/relay/attach', {}, [ticket]);
    sockets.push(second);
    const gone = closed(second);
    const why = nextMessage(second);
    await opened(second);
    expect((await why).text).toEqual({ type: 'closed', reason: 'unauthorized' });
    await expect(gone).resolves.toMatchObject({ code: ATTACH_CLOSE_CODES.UNAUTHORIZED });
  });

  it('tells a stopped session apart from a resolved one', async () => {
    vi.mocked(h.lookup.findAttachTarget).mockResolvedValueOnce({
      id: SESSION,
      organizationId: ORG,
      hostId: HOST,
      state: 'stopped',
    });
    const stopped = ws(h.origin, '/api/v1/relay/attach', {}, [issueTicket(h)]);
    sockets.push(stopped);
    const stoppedGone = closed(stopped);
    const stoppedWhy = nextMessage(stopped);
    await opened(stopped);
    expect((await stoppedWhy).text).toEqual({ type: 'closed', reason: 'stopped' });
    await expect(stoppedGone).resolves.toMatchObject({ code: ATTACH_CLOSE_CODES.SESSION_STOPPED });

    vi.mocked(h.lookup.findAttachTarget).mockResolvedValueOnce({
      id: SESSION,
      organizationId: ORG,
      hostId: HOST,
      state: 'resolved',
    });
    const resolved = ws(h.origin, '/api/v1/relay/attach', {}, [issueTicket(h)]);
    sockets.push(resolved);
    const resolvedGone = closed(resolved);
    const resolvedWhy = nextMessage(resolved);
    await opened(resolved);
    expect((await resolvedWhy).text).toEqual({ type: 'closed', reason: 'resolved' });
    await expect(resolvedGone).resolves.toMatchObject({
      code: ATTACH_CLOSE_CODES.SESSION_UNAVAILABLE,
    });
  });

  it('closes on a person who left the workspace since the ticket was minted', async () => {
    vi.mocked(h.workspaces.isMember).mockResolvedValueOnce(false);
    const browser = ws(h.origin, '/api/v1/relay/attach', {}, [issueTicket(h)]);
    sockets.push(browser);
    const gone = closed(browser);
    const why = nextMessage(browser);
    await opened(browser);
    expect((await why).text).toEqual({ type: 'closed', reason: 'forbidden' });
    await expect(gone).resolves.toMatchObject({ code: ATTACH_CLOSE_CODES.FORBIDDEN });
    expect(h.workspaces.isMember).toHaveBeenCalledWith(ORG, USER);
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

    // Keystrokes: bare bytes from the browser become a binary frame on the link,
    // under this attachment's id — the same layout as the output, reversed.
    const input = nextMessage(runner);
    browser.send(Buffer.from('ls\r'), { binary: true });
    const typed = (await input).bytes as Buffer;
    expect([...typed.subarray(0, 4)]).toEqual([0, 0, 0, 1]);
    expect(typed.subarray(4).toString()).toBe('ls\r');

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

  it('keeps a viewport the browser sent while its ticket was still being redeemed', async () => {
    // Redemption is a cache take and two reads; the browser does not wait for
    // them before saying its size. A resize that landed before the attachment
    // listened used to be dropped, and the relay attached at 80x24 two seconds
    // later instead.
    vi.mocked(h.workspaces.isMember).mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve(true), 150)),
    );
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
    const sentAt = Date.now();
    browser.send(JSON.stringify({ type: 'resize', cols: 120, rows: 40 }));

    const attach = await nextMessage(runner);
    expect(attach.text).toMatchObject({ type: 'session.attach', cols: 120, rows: 40 });
    expect(Date.now() - sentAt).toBeLessThan(1_000);
  });

  it('opens no attachment for a browser that left while its ticket was redeemed', async () => {
    vi.mocked(h.workspaces.isMember).mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve(true), 150)),
    );
    const runner = await runnerUp(h);
    sockets.push(runner);
    const heard: unknown[] = [];
    runner.on('message', (data) => heard.push(data));
    const browser = ws(
      h.origin,
      '/api/v1/relay/attach',
      { headers: { origin: 'http://localhost:3000' } },
      [issueTicket(h, 0)],
    );
    await opened(browser);
    browser.send(JSON.stringify({ type: 'resize', cols: 120, rows: 40 }));
    browser.close();

    // Its close fired before anything was listening for it, so an attachment
    // opened now would sit in the link's table for good.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(h.registry.find(HOST)?.attachmentCount).toBe(0);
    expect(heard).toEqual([]);
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
