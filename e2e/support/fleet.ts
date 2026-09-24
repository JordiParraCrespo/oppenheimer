import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type APIRequestContext, expect } from '@playwright/test';
import { API_URL, WEB_URL } from '../playwright.config';
import { buildLocalFleet, startLocalHost, teardownLocalFleet } from './fleet-local';
import { mintPairingToken } from './sessions';

/**
 * The fleet: real runners, one per container, paired with the real API.
 *
 * Each host is a Debian container with its own Unix account, home, tmux server
 * and host key (`e2e/fleet/Dockerfile`), which is the shape the product assumes
 * — one runner per machine. Nothing about a host is faked except the agent:
 * `claude` is a shim that prints its argv and hands the pane to a shell. Git is
 * a `git daemon` container seeded with the repositories the GitHub stub lists,
 * which the hosts reach through `url.insteadOf`, so the runner still clones
 * `https://github.com/<owner>/<repo>.git` as far as it knows.
 *
 * Plain `docker`, not Compose: CI's runner has the daemon but not the plugin,
 * and a test wants to start and break hosts one at a time anyway.
 * What it covers: `product/versions/mvp/11-api-implementation-plan.md`, slice 6.
 *
 * `FLEET_HOSTS=local` runs the same hosts on the machine running the suite
 * instead (`support/fleet-local.ts`), for one that cannot build the image. A
 * test that needs a host to lose its network alone skips there.
 */
export const FLEET_HOSTS = process.env.FLEET_HOSTS === 'local' ? 'local' : 'container';

/**
 * What every host this fleet starts can do, known before one is paired —
 * pairing is throttled per address (F5), so a spec that cannot hold on these
 * hosts skips before spending registrations on them. Each host carries the
 * same facts (`machine`, `cutLink`) for the spec that has one in hand.
 */
export const FLEET_CAN = {
  /** Every host's `hostname` is its own, so it can prove where a pane runs. */
  nameItsMachine: FLEET_HOSTS === 'container',
  /** A host can lose its network alone (`cutLink`). */
  loseItsNetwork: FLEET_HOSTS === 'container',
};
const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..');
export const FLEET_IMAGE = process.env.FLEET_IMAGE ?? 'oppenheimer-fleet-host:dev';
const NETWORK = 'oppenheimer-fleet';
const LABEL = 'dev.oppenheimer.fleet=1';
const GIT_SERVER = 'oppenheimer-fleet-git';

function docker(args: string[], options: { quiet?: boolean } = {}): string {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: options.quiet ? ['ignore', 'pipe', 'ignore'] : ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function tryDocker(args: string[]): string | undefined {
  try {
    return docker(args, { quiet: true });
  } catch {
    return undefined;
  }
}

/** Where the containers reach the API: the machine running it, on its port. */
function controlPlaneUpstream(): string {
  return `host.docker.internal:${new URL(API_URL).port || '80'}`;
}

/**
 * Build the runner for the daemon's architecture, bake it into the host image,
 * and start the network and the git server. Idempotent.
 */
export function buildFleet(): void {
  if (FLEET_HOSTS === 'local') {
    buildLocalFleet(REPO_ROOT);
    return;
  }
  const arch = docker(['version', '--format', '{{.Server.Arch}}']);
  const out = mkdtempSync(join(tmpdir(), 'oppenheimer-fleet-'));
  execFileSync('go', ['build', '-trimpath', '-o', join(out, 'runner'), './cmd/runner'], {
    cwd: join(REPO_ROOT, 'apps', 'runner'),
    env: { ...process.env, CGO_ENABLED: '0', GOOS: 'linux', GOARCH: arch },
    stdio: 'inherit',
  });
  execFileSync(
    'docker',
    [
      'build',
      '--quiet',
      '--tag',
      FLEET_IMAGE,
      '--build-context',
      `runner=${out}`,
      join(REPO_ROOT, 'e2e', 'fleet'),
    ],
    { stdio: 'inherit' },
  );

  teardownFleet();
  docker(['network', 'create', '--label', LABEL, NETWORK]);
  docker([
    'run',
    '--detach',
    '--name',
    GIT_SERVER,
    '--label',
    LABEL,
    '--network',
    NETWORK,
    '--network-alias',
    'git-server',
    '--entrypoint',
    '/usr/local/bin/fleet-git-server',
    FLEET_IMAGE,
  ]);
}

/** Remove every container and the network a fleet run created. */
export function teardownFleet(): void {
  if (FLEET_HOSTS === 'local') {
    teardownLocalFleet();
    return;
  }
  const ids = tryDocker(['ps', '--all', '--quiet', '--filter', `label=${LABEL}`]);
  if (ids) docker(['rm', '--force', ...ids.split('\n')], { quiet: true });
  tryDocker(['network', 'rm', NETWORK]);
}

export interface FleetHost {
  /** The host's pairing name, which the API keeps as the host's row name. */
  name: string;
  /**
   * The name the host's own `hostname` prints. A container's is its pairing
   * name; hosts on the suite's machine all print that machine's, so a spec
   * proving *which* host ran something checks these are distinct first.
   */
  machine: string;
  /**
   * Pull the host's network cable: the link and every new dial fail. Only a
   * host with a network of its own has one, so a spec that pulls it skips
   * when it is absent.
   */
  cutLink?(): void;
  restoreLink?(): void;
  /** Kill `runner run` only; tmux is its sibling and survives (02 §12). */
  killRunner(): void;
  /** Run a command on the host, as its user. */
  exec(command: string): string;
  logs(): string;
}

let hostCounter = 0;

/**
 * A name no other worker or rerun holds. It is the container, the machine's
 * hostname and — because the API keeps the name a token was minted with — the
 * host's row, so mint the token with it.
 */
export function uniqueHostName(label: string): string {
  hostCounter += 1;
  return `${label}-${process.pid}-${hostCounter}`;
}

/**
 * Start a host that redeems `token` through `runner register` and then runs the
 * daemon.
 */
export function startHost(container: string, token: string): FleetHost {
  if (FLEET_HOSTS === 'local') return startLocalHost(container, token);
  docker([
    'run',
    '--detach',
    '--name',
    container,
    '--hostname',
    container,
    '--label',
    LABEL,
    '--network',
    NETWORK,
    '--add-host',
    'host.docker.internal:host-gateway',
    '--env',
    `CONTROL_PLANE_UPSTREAM=${controlPlaneUpstream()}`,
    '--env',
    `REGISTRATION_TOKEN=${token}`,
    '--env',
    `HOST_NAME=${container}`,
    FLEET_IMAGE,
  ]);
  const exec = (...args: string[]) => docker(['exec', container, ...args]);
  return {
    name: container,
    machine: container,
    cutLink: () => void exec('fleet-host', 'cut'),
    restoreLink: () => void exec('fleet-host', 'restore'),
    killRunner: () => void exec('fleet-host', 'kill-runner'),
    exec: (command) => exec('bash', '-lc', command),
    logs: () => tryDocker(['logs', container]) ?? '',
  };
}

/**
 * Pair `count` hosts with the caller's account through the real path — a token
 * minted by the API, `runner register` on the host — and wait for each online.
 */
export async function pairedHosts(api: APIRequestContext, count: number, label: string) {
  const hosts: FleetHost[] = [];
  for (let i = 1; i <= count; i += 1) {
    const name = uniqueHostName(`${label}-${i}`);
    hosts.push(startHost(name, await mintPairingToken(api, name)));
  }
  const rows = await Promise.all(hosts.map((host) => waitForHost(api, host, true)));
  return hosts.map((host, i) => ({ host, id: rows[i].id }));
}

interface HostRow {
  id: string;
  name: string;
  online: boolean;
}

/** Wait until the caller's host named `name` is paired and in the wanted state. */
export async function waitForHost(
  api: APIRequestContext,
  host: FleetHost,
  online: boolean,
  timeout = 60_000,
): Promise<HostRow> {
  let found: HostRow | undefined;
  await expect
    .poll(
      async () => {
        const response = await api.get('/api/v1/hosts', { failOnStatusCode: false });
        if (!response.ok()) return `GET /hosts answered ${response.status()}`;
        found = ((await response.json()) as HostRow[]).find((row) => row.name === host.name);
        return found?.online;
      },
      {
        message: `${host.name} ${online ? 'online' : 'offline'}\n${host.logs().slice(-2_000)}`,
        timeout,
        // Every worker polls from one address, and the global throttle is
        // per address: slow enough that four of them stay under it.
        intervals: [1_000, 2_500],
      },
    )
    .toBe(online);
  return found as HostRow;
}

/**
 * A browser's terminal on one window of a session, over the real attach socket:
 * a ticket minted through the API, the ticket as the subprotocol, the web app's
 * origin, binary frames for bytes and text frames for control.
 *
 * `credit` acknowledges every chunk once read, as the console does. Without it
 * the runner stops reading the pane after 256 KB (the credit window, 01), which
 * is what a test that only reads a prompt wants and one that prints a lot does
 * not. The screen keeps the last `keep` bytes, so a flood does not grow the
 * worker without bound.
 */
export interface Terminal {
  send(text: string): void;
  screen(): string;
  waitFor(text: string, timeout?: number): Promise<string>;
  /** Every byte the socket delivered, whatever the screen still keeps. */
  bytes(): number;
  /** The close code, once the socket has closed. */
  closeCode(): number | null;
  close(): Promise<void>;
}

export interface AttachOptions {
  window?: number;
  credit?: boolean;
  keep?: number;
}

export async function attach(
  api: APIRequestContext,
  sessionId: string,
  { window = 0, credit = false, keep = 1_000_000 }: AttachOptions = {},
): Promise<Terminal> {
  const minted = await api.post(`/api/v1/sessions/${sessionId}/attach-ticket`, {
    data: { window },
    failOnStatusCode: false,
  });
  expect(minted.status(), await minted.text()).toBe(201);
  const { ticket } = (await minted.json()) as { ticket: string };

  const socket = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/api/v1/relay/attach`, {
    protocols: [ticket],
    // Undici's extension: a browser always sends its origin, and the relay
    // refuses an upgrade without one it serves.
    headers: { origin: WEB_URL },
  } as unknown as string[]);
  socket.binaryType = 'arraybuffer';
  let screen = '';
  let bytes = 0;
  let closeCode: number | null = null;
  const controls: { type?: string }[] = [];
  socket.addEventListener('message', (event) => {
    if (typeof event.data === 'string') {
      try {
        controls.push(JSON.parse(event.data));
      } catch {
        // Not a control frame this helper understands; the socket carries on.
      }
      return;
    }
    const chunk = Buffer.from(event.data as ArrayBuffer);
    bytes += chunk.byteLength;
    screen = (screen + chunk.toString()).slice(-keep);
    if (credit) socket.send(JSON.stringify({ type: 'credit', bytes: chunk.byteLength }));
  });
  socket.addEventListener('close', (event) => {
    closeCode = event.code;
  });
  await new Promise<void>((ok, fail) => {
    socket.addEventListener('open', () => ok(), { once: true });
    socket.addEventListener('error', () => fail(new Error('attach socket refused')), {
      once: true,
    });
  });
  socket.send(JSON.stringify({ type: 'resize', cols: 120, rows: 30 }));
  await expect
    .poll(() => controls.some((c) => c.type === 'attached'), { message: 'attached' })
    .toBe(true);

  return {
    send: (text) => socket.send(Buffer.from(text)),
    screen: () => screen,
    async waitFor(text, timeout = 20_000) {
      await expect
        .poll(() => screen.includes(text), {
          message: `"${text}" on screen`,
          timeout,
          intervals: [5, 50],
        })
        .toBe(true);
      return screen;
    },
    bytes: () => bytes,
    closeCode: () => closeCode,
    close: () =>
      new Promise<void>((done) => {
        if (socket.readyState === WebSocket.CLOSED) return done();
        socket.addEventListener('close', () => done(), { once: true });
        socket.close(1000, 'done');
      }),
  };
}
