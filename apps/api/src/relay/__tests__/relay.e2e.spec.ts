import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { CacheService } from '@oppenheimer/backend-cache';
import { Some } from 'oxide.ts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import type { RepositoryAccessPort } from '../../github/application/repository-access.port';
import { HostAssertionResolver } from '../../hosts/application/host-assertion.resolver';
import type { HostKeyPort } from '../../hosts/application/host-key.port';
import type { HostPresencePort } from '../../hosts/application/host-presence.port';
import type { HostRepositoryPort } from '../../hosts/database/host.repository.port';
import { HostEntity } from '../../hosts/domain/host.entity';
import { keyFingerprint } from '../../hosts/infrastructure/host-assertion.util';
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
import { RunnerLinkGateway } from '../infrastructure/runner-link.gateway';

/**
 * The real runner binary against the real relay, minus Postgres and Redis.
 *
 * What is real: the Go runner (`runner run`) with a real Ed25519 identity, its
 * boot assertion verified by the real `HostAssertionResolver`; the two
 * gateways; tmux; git (a public repository is cloned); the frame layout both
 * ways. What is faked: the rows (a host, a session, a ticket) and the log,
 * which record what the relay hands them.
 *
 * Opt in with `RELAY_E2E=1`: it needs `go`, `tmux`, `git` and the network,
 * and takes a while. `claude` is a shim on PATH that prints its argv and
 * execs a shell, so the launch argv is observable and the pane is interactive.
 */
const enabled = process.env.RELAY_E2E === '1';
const RUNNER_DIR = resolve(__dirname, '..', '..', '..', '..', 'runner');
const HOST = 'a1b2c3d4-0000-4000-8000-000000000001';
const ORG = 'a1b2c3d4-0000-4000-8000-000000000002';
const USER = 'a1b2c3d4-0000-4000-8000-000000000003';
const SESSION = 'a1b2c3d4-0000-4000-8000-000000000004';
const CHECKOUT = 'a1b2c3d4-0000-4000-8000-000000000005';
const CP_FINGERPRINT = 'c'.repeat(64);

interface World {
  server: Server;
  origin: string;
  registry: InProcessLinkRegistry;
  batches: RunnerEventBatch[];
  tickets: Map<string, AttachTicket>;
  runner: ChildProcess;
  log: string[];
  scratch: string;
}

function hostKeypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  // The runner's store holds the 64-byte private key (seed ‖ public), base64.
  const seed = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32);
  return {
    publicBase64: raw.toString('base64'),
    privateBase64: Buffer.concat([seed, raw]).toString('base64'),
  };
}

async function boot(): Promise<World> {
  Logger.overrideLogger(false);
  const scratch = join(tmpdir(), `relay-e2e-${process.pid}`);
  const home = join(scratch, 'home');
  const workspaces = join(scratch, 'workspaces');
  const bin = join(scratch, 'bin');
  for (const dir of [home, workspaces, bin]) mkdirSync(dir, { recursive: true });
  execFileSync('go', ['build', '-o', join(bin, 'runner'), './cmd/runner'], {
    cwd: RUNNER_DIR,
    stdio: 'inherit',
  });
  writeFileSync(
    join(bin, 'claude'),
    '#!/bin/sh\nprintf "CLAUDE-SHIM argv=%s\\n" "$*"\nexec sh -i\n',
  );
  chmodSync(join(bin, 'claude'), 0o755);

  const keys = hostKeypair();
  const server = createServer((_request, response) => response.writeHead(404).end());
  await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  writeFileSync(
    join(home, 'config.json'),
    JSON.stringify({
      hostId: HOST,
      name: 'e2e',
      controlPlaneUrl: origin,
      fingerprint: CP_FINGERPRINT,
      publicKey: keys.publicBase64,
      channel: 'stable',
      registeredAt: new Date().toISOString(),
    }),
  );
  writeFileSync(join(home, 'host.key'), keys.privateBase64, { mode: 0o600 });
  chmodSync(home, 0o700);

  const host = HostEntity.create({
    id: HOST,
    props: {
      ownerUserId: USER,
      name: 'e2e',
      hostname: null,
      os: null,
      arch: null,
      runnerVersion: null,
      capabilities: null,
      publicKey: keys.publicBase64,
      publicKeyFingerprint: keyFingerprint(keys.publicBase64) as string,
      lastSeenAt: null,
      unpairedAt: null,
    },
  });
  const hosts = {
    findOneByIdForMachine: vi.fn().mockResolvedValue(Some(host)),
  } as unknown as HostRepositoryPort;
  const tickets = new Map<string, AttachTicket>();
  const cache = {
    setIfAbsent: vi.fn().mockResolvedValue(true),
    take: vi.fn(async (key: string) => {
      const value = tickets.get(key);
      tickets.delete(key);
      return value;
    }),
  } as unknown as CacheService;
  const config = {
    get: (key: string) =>
      ({
        'hosts.controlPlaneUrl': origin,
        'hosts.signingKeyFingerprint': CP_FINGERPRINT,
        'app.frontendUrl': 'http://localhost:3000',
        'app.adminFrontendUrl': 'http://localhost:3003',
      })[key],
  } as unknown as ConfigService;

  const batches: RunnerEventBatch[] = [];
  const events: RecordSessionEventsPort = {
    record: async (batch) => {
      batches.push(batch);
      return {
        batchId: batch.batchId,
        accepted: batch.events.map((e) => e.idempotencyKey),
        rejected: [],
      };
    },
  };
  const presence: HostPresencePort = { observe: vi.fn().mockResolvedValue(undefined) };
  const reconciliation: SessionReconciliationPort = {
    reconcile: vi.fn().mockResolvedValue({ redispatched: [], stopped: [] }),
  };
  const lookup: SessionLookupPort = {
    findAttachTarget: async (id) =>
      id === SESSION ? { id, organizationId: ORG, hostId: HOST, state: 'live' } : null,
    findCredentialTarget: vi.fn().mockResolvedValue(null),
  };
  const workspaces_: WorkspaceLookupPort = {
    slugOf: vi.fn().mockResolvedValue('jordi'),
    isMember: vi.fn().mockResolvedValue(true),
  };

  const registry = new InProcessLinkRegistry(() => 0);
  const assertions = new HostAssertionResolver(hosts, cache, config);
  const runners = new RunnerLinkGateway(
    assertions,
    registry,
    new RelayEventsProcessor(events, presence, reconciliation),
    new CredentialsProcessor(
      lookup,
      { mintRepositoryToken: vi.fn() } as unknown as RepositoryAccessPort,
      { publicKeyOf: vi.fn() } as unknown as HostKeyPort,
    ),
    config,
  );
  const browsers = new BrowserAttachGateway(cache, lookup, registry, workspaces_, config);
  new RelayUpgradeGateway({} as never, runners, browsers).mount(server);

  const log: string[] = [];
  const runner = spawn(join(bin, 'runner'), ['run'], {
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      HOME: scratch,
      RUNNER_HOME: home,
      RUNNER_WORKSPACES: workspaces,
      RUNNER_LOG_LEVEL: 'debug',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  runner.stdout?.on('data', (chunk) => log.push(String(chunk)));
  runner.stderr?.on('data', (chunk) => log.push(String(chunk)));
  return { server, origin, registry, batches, tickets, runner, log, scratch };
}

async function until<T>(what: string, probe: () => T | undefined, ms = 60_000): Promise<T> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const value = probe();
    if (value !== undefined) return value;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`timed out waiting for ${what}`);
}

describe.skipIf(!enabled)('the runner and the relay, end to end', () => {
  let w: World;

  beforeAll(async () => {
    w = await boot();
  }, 180_000);

  afterAll(async () => {
    w?.runner.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 1_000));
    try {
      execFileSync('tmux', ['-L', 'oppenheimer', 'kill-server'], { stdio: 'ignore' });
    } catch {
      // No server left, which is the goal.
    }
    await new Promise<void>((r) => w?.server.close(() => r()));
    if (w && existsSync(w.scratch)) execFileSync('rm', ['-rf', w.scratch]);
  });

  it('dials with its boot assertion, says hello, and is welcomed', async () => {
    const link = await until('the runner link', () => w.registry.find(HOST), 30_000);
    expect(link.hostId).toBe(HOST);
    expect(link.epoch).toBe(1);
    expect(w.log.join('')).toContain('control-plane link up');
  });

  it('creates a session from session.create: a clone, a worktree, and window 0 running the launch argv', async () => {
    const link = w.registry.find(HOST);
    expect(link).toBeDefined();
    const sent = link?.send({
      type: 'session.create',
      commandId: randomUUID(),
      sessionId: SESSION,
      organizationSlug: 'jordi',
      projectSlug: 'hello-world',
      sessionSlug: 'bold-otter-3f9a7k',
      agent: 'claude-code',
      launch: { model: 'opus', permission: 'ask', effort: 'medium' },
      prompt: 'say hello',
      branch: 'oppenheimer/hello-world/bold-otter-3f9a7k',
      checkouts: [
        {
          checkoutId: CHECKOUT,
          githubRepoId: 1296269,
          repositoryFullName: 'octocat/Hello-World',
          directoryName: 'hello-world',
          baseBranch: 'master',
        },
      ],
      cwdCheckoutId: CHECKOUT,
    });
    expect(sent).toBe(true);
    const started = await until(
      'session.started',
      () => w.batches.flatMap((b) => b.events).find((e) => e.kind === 'session.started'),
      120_000,
    );
    expect(started.idempotencyKey).toMatch(/^run-[0-9a-f]+:\d+$/);
    const payload = JSON.parse(started.payload) as {
      checkouts: { branch: string; path: string }[];
    };
    expect(payload.checkouts[0].branch).toBe('oppenheimer/hello-world/bold-otter-3f9a7k');
    expect(existsSync(payload.checkouts[0].path)).toBe(true);
    const windows = execFileSync('tmux', [
      '-L',
      'oppenheimer',
      'list-windows',
      '-t',
      `opp-${SESSION}`,
    ]).toString();
    expect(windows).toContain('0:');
  }, 130_000);

  it('attaches a browser, streams the pane, and types into it', async () => {
    const ticket = `t-${randomUUID()}`;
    w.tickets.set(`attach:${ticket}`, {
      sessionId: SESSION,
      organizationId: ORG,
      window: 0,
      userId: USER,
    });
    const browser = new WebSocket(
      `${w.origin.replace('http', 'ws')}/api/v1/relay/attach`,
      [ticket],
      {
        headers: { origin: 'http://localhost:3000' },
      },
    );
    const output: Buffer[] = [];
    const controls: unknown[] = [];
    browser.on('message', (data, isBinary) => {
      if (isBinary) output.push(data as Buffer);
      else controls.push(JSON.parse(String(data)));
    });
    const closed = new Promise<number>((r) => browser.once('close', (code) => r(code)));
    await new Promise<void>((r, reject) => {
      browser.once('open', r);
      browser.once('error', reject);
    });
    browser.send(JSON.stringify({ type: 'resize', cols: 100, rows: 30 }));
    await until(
      'attached',
      () => controls.find((c) => (c as { type: string }).type === 'attached'),
      10_000,
    );

    // The pane's tail: the shim printed the launch argv the runner built from
    // the structured launch, and a shell prompt is up.
    const screen = await until(
      'the launch argv on screen',
      () => {
        const text = Buffer.concat(output).toString();
        return text.includes('CLAUDE-SHIM argv=') ? text : undefined;
      },
      20_000,
    );
    expect(screen).toContain('--model opus --permission-mode manual --effort high say hello');

    // Keystrokes: bare bytes in, the shell's echo and output back.
    browser.send(Buffer.from('echo relay-e2e-$((40+2))\r'), { binary: true });
    await until(
      'the command output',
      () => (Buffer.concat(output).toString().includes('relay-e2e-42') ? true : undefined),
      10_000,
    );

    // Closing the tab frees the attachment on both sides.
    browser.close(1000, 'done');
    await closed;
    await until(
      'the attachment freed',
      () => (w.registry.find(HOST)?.attachmentCount === 0 ? true : undefined),
      5_000,
    );
  }, 60_000);

  it('carries out a stop without echoing the entry the control plane already wrote', async () => {
    const link = w.registry.find(HOST);
    link?.send({ type: 'session.stop', commandId: randomUUID(), sessionId: SESSION });
    // tmux no longer holds the session; the worktree survives for Restart.
    await until(
      'tmux to drop the session',
      () => {
        try {
          execFileSync('tmux', ['-L', 'oppenheimer', 'has-session', '-t', `opp-${SESSION}`], {
            stdio: 'ignore',
          });
          return undefined;
        } catch {
          return true;
        }
      },
      20_000,
    );
    // One action, one entry: the API recorded the stop it ordered, so the runner
    // reports nothing for it — a stopped it observes on its own is another matter.
    await new Promise((r) => setTimeout(r, 1_000));
    expect(w.batches.flatMap((b) => b.events).map((e) => e.kind)).not.toContain('session.stopped');
    // What the log would have received, for a person reading the run.
    process.stdout.write(
      `\nrecorded events:\n${w.batches
        .flatMap((b) => b.events)
        .map((e) => `  ${e.idempotencyKey} ${e.kind} ${e.payload}`)
        .join('\n')}\n`,
    );
  }, 30_000);
});
