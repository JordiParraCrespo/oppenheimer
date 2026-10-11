import { execFileSync, spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The machines of a local stack on simulated networks (`e2e/netsim`): the
 * relay stays where the API runs, and the browser and each host get a network
 * namespace of their own, as far away and behind as slow a link as their
 * placement says. Linux and root only; `available()` says whether this
 * machine can.
 */
const ROOT = process.env.NETSIM_DIR ?? join(tmpdir(), 'oppenheimer-netsim');
const STATE = join(ROOT, 'state');
const BIN = join(ROOT, 'netsim');
const CONTROL = process.env.NETSIM_CONTROL ?? '127.0.0.1:7077';

export interface Placement {
  location: string;
  access: string;
  lan?: string;
}

export interface NetsimNode {
  name: string;
  placement: Placement;
  /** Loopback ports on the node that reach the same port on the relay. */
  ports: number[];
}

export interface LegStats {
  from: string;
  to: string;
  packets: number;
  bytes: number;
  dropped: number;
}

export function netsimAvailable(): boolean {
  return process.platform === 'linux' && process.getuid?.() === 0 && existsSync('/dev/net/tun');
}

export function buildNetsim(repoRoot: string): void {
  mkdirSync(ROOT, { recursive: true });
  execFileSync('go', ['build', '-trimpath', '-o', BIN, '.'], {
    cwd: join(repoRoot, 'e2e', 'netsim'),
    env: { ...process.env, CGO_ENABLED: '0' },
    stdio: 'inherit',
  });
}

/** Starts the simulation and waits until every namespace is up. */
export async function netsimUp(relay: Placement, relayPorts: number[], nodes: NetsimNode[]) {
  netsimDown();
  mkdirSync(STATE, { recursive: true });
  const config = join(ROOT, 'nodes.json');
  writeFileSync(config, JSON.stringify({ relay, relayPorts, nodes }, null, 2));
  const log = join(ROOT, 'netsim.log');
  const child = spawn(
    'sh',
    [
      '-c',
      'exec "$@" >>"$0" 2>&1',
      log,
      BIN,
      'up',
      '--config',
      config,
      '--state',
      STATE,
      '--control',
      CONTROL,
    ],
    { detached: true, stdio: 'ignore' },
  );
  child.unref();
  writeFileSync(join(ROOT, 'pid'), String(child.pid));
  for (let i = 0; i < 100; i += 1) {
    if (existsSync(join(STATE, 'ready'))) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`netsim did not come up:\n${readFileSync(log, 'utf8')}`);
}

export function netsimDown(): void {
  const pid = join(ROOT, 'pid');
  if (!existsSync(pid)) return;
  try {
    process.kill(-Number(readFileSync(pid, 'utf8')), 'SIGTERM');
  } catch {}
  rmSync(pid, { force: true });
  // The namespaces are released as `up` exits; give it the moment.
  for (let i = 0; i < 50 && existsSync(join(STATE, 'ready')); i += 1) {
    execFileSync('sleep', ['0.1']);
  }
}

/** The argv prefix that runs a command on `node`. */
export function enter(node: string): string[] {
  return [BIN, 'exec', '--state', STATE, node, '--'];
}

/** A Chromium that runs on `node`, for `launch({ executablePath })`. */
export function browserOn(node: string, chromium: string): string {
  const wrapper = join(ROOT, `chromium-${node}`);
  const quoted = [...enter(node), chromium].map((arg) => `'${arg}'`).join(' ');
  writeFileSync(wrapper, `#!/bin/sh\nexec ${quoted} "$@"\n`);
  chmodSync(wrapper, 0o755);
  return wrapper;
}

async function control(method: string, path: string, body?: unknown): Promise<Response> {
  const response = await fetch(`http://${CONTROL}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`netsim ${method} ${path}: ${await response.text()}`);
  return response;
}

/** Moves a node; packets already in flight keep their times. */
export async function place(node: string, placement: Placement): Promise<void> {
  await control('PUT', `/nodes/${node}`, placement);
}

export async function legStats(): Promise<LegStats[]> {
  return (await control('GET', '/stats')).json();
}

export async function resetLegStats(): Promise<void> {
  await control('DELETE', '/stats');
}
