#!/usr/bin/env node
/**
 * The local stack: the API, its stubs and a real runner host on this machine,
 * started in the order they depend on each other and torn down the same way.
 *
 *   node scripts/stack/stack.mjs up [--web] [--no-build]
 *   node scripts/stack/stack.mjs host [--name <name>]
 *   node scripts/stack/stack.mjs status
 *   node scripts/stack/stack.mjs down [--purge]
 *
 * `up` is Postgres and Redis (Docker), the GitHub and namer stubs, the migrated
 * API and, with `--web`, the console. `host` pairs one real runner with a fresh
 * account through the real API — the same path a person takes — and serves the
 * stub's repositories from a local `git daemon`, so a session clones, runs in
 * tmux and streams through the relay. The only fake on the host is `claude`
 * (`e2e/fleet/claude`). What to run against it is `.agents/skills/local-stack`.
 *
 * Everything it starts is recorded under `.stack/` (or `STACK_DIR`): pids,
 * logs, the host's account and credentials. `down` stops what is recorded
 * there and nothing else.
 *
 * It is the containerless sibling of the fleet (`e2e/support/fleet.ts`): one
 * host, on this machine, for sandboxes that can run Docker containers but
 * cannot build the fleet's image.
 */
import { execFileSync, spawn } from 'node:child_process';
import {
  chownSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { connect } from 'node:net';
import { userInfo } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STATE = resolve(process.env.STACK_DIR ?? join(ROOT, '.stack'));
const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';
const GITHUB_STUB_URL = process.env.GITHUB_STUB_URL ?? 'http://127.0.0.1:4319';
const COMPOSE = ['compose', '-f', join(ROOT, 'docker', 'docker-compose.dev.yml')];
const IMAGES = ['postgres:16-alpine', 'redis:7-alpine'];
/**
 * Docker Hub answers anonymous pulls from a shared address with 429. These
 * serve the same official images; a pull from one is retagged to the name the
 * compose file asks for.
 */
const MIRRORS = ['mirror.gcr.io/library/', 'public.ecr.aws/docker/library/'];
/** The dedicated account the host runs as when this runs as root. */
const HOST_ACCOUNT = 'oppenheimer-host';
const STUB_ENV_MARKER = 'Added by e2e/support/stub-env.ts';
const PASSWORD = 'Sup3rSecret!Pass';
const isRoot = process.getuid?.() === 0;

// --------------------------------------------------------------------- plumbing

function log(message) {
  console.log(`stack: ${message}`);
}

function fail(message) {
  console.error(`stack: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', ...options });
}

function succeeds(command, args) {
  try {
    run(command, args);
    return true;
  } catch {
    return false;
  }
}

function has(command) {
  return succeeds('sh', ['-c', `command -v ${command}`]);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

const pidsFile = join(STATE, 'pids.json');
const hostFile = join(STATE, 'host.json');

/**
 * Start a long-lived process in its own process group, logging to `.stack/`.
 * Recorded by name so `down` can stop the whole group — `pnpm` and `runuser`
 * both put a child between the pid and the process that matters.
 */
function daemon(name, command, args, options = {}) {
  mkdirSync(STATE, { recursive: true });
  const out = join(STATE, `${name}.log`);
  writeFileSync(out, '');
  const child = spawn('sh', ['-c', 'exec "$@" >>"$0" 2>&1', out, command, ...args], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
    ...options,
  });
  child.unref();
  const pids = readJson(pidsFile, {});
  pids[name] = child.pid;
  writeFileSync(pidsFile, JSON.stringify(pids, null, 2));
  return out;
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function portOpen(port, host = '127.0.0.1') {
  return new Promise((done) => {
    const socket = connect({ port, host });
    socket.once('connect', () => {
      socket.destroy();
      done(true);
    });
    socket.once('error', () => done(false));
  });
}

async function waitFor(what, check, { timeout = 60_000, logFile } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  const tail =
    logFile && existsSync(logFile) ? `\n${readFileSync(logFile, 'utf8').slice(-2_000)}` : '';
  fail(`${what} did not come up within ${timeout / 1000}s${tail}`);
}

async function httpOk(url) {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------------- docker

async function ensureDocker() {
  if (!has('docker')) fail('docker is not installed');
  if (succeeds('docker', ['info'])) return;
  // A cloud sandbox ships the daemon but does not start it.
  if (!isRoot || !has('dockerd')) {
    fail('the Docker daemon is not running; start Docker and run this again');
  }
  log('starting dockerd');
  const out = daemon('dockerd', 'dockerd', []);
  await waitFor('dockerd', () => succeeds('docker', ['info']), { timeout: 30_000, logFile: out });
}

function ensureImage(image) {
  if (succeeds('docker', ['image', 'inspect', image])) return;
  log(`pulling ${image}`);
  if (succeeds('docker', ['pull', '-q', image])) return;
  for (const mirror of MIRRORS) {
    if (succeeds('docker', ['pull', '-q', `${mirror}${image}`])) {
      run('docker', ['tag', `${mirror}${image}`, image]);
      log(`pulled ${image} from ${mirror}`);
      return;
    }
  }
  fail(`could not pull ${image} from Docker Hub or its mirrors`);
}

async function startInfrastructure() {
  await ensureDocker();
  for (const image of IMAGES) ensureImage(image);
  run('docker', [...COMPOSE, 'up', '-d', '--pull', 'never']);
  await waitFor('Postgres', () =>
    succeeds('docker', [...COMPOSE, 'exec', '-T', 'postgres', 'pg_isready', '-U', 'oppenheimer']),
  );
  log('Postgres and Redis are up');
}

// ---------------------------------------------------------------------- the API

/**
 * The root `.env`, pointed at the stubs. The keys `stub-env.ts` generates are
 * throwaway (a GitHub App that does not exist, a control plane no real runner
 * trusts), and appended once: a second set would re-key the control plane and
 * orphan every paired host.
 */
function ensureEnv() {
  const env = join(ROOT, '.env');
  if (!existsSync(env)) {
    copyFileSync(join(ROOT, '.env.example'), env);
    log('created .env from .env.example');
  }
  if (!readFileSync(env, 'utf8').includes(STUB_ENV_MARKER)) {
    const lines = run('node', ['--experimental-strip-types', 'e2e/support/stub-env.ts']);
    writeFileSync(env, readFileSync(env, 'utf8') + lines);
    log('pointed .env at the stubs');
  }
}

async function startStub(name, port) {
  if (await portOpen(port)) return;
  const out = daemon(name, 'node', ['--experimental-strip-types', `e2e/support/${name}.ts`]);
  await waitFor(name, () => portOpen(port), { logFile: out });
}

async function startApi({ build }) {
  if (build) {
    log('building the API (cached after the first run)');
    run('pnpm', ['turbo', 'run', 'build', '--filter=@oppenheimer/api...'], { stdio: 'inherit' });
  }
  run('pnpm', ['--filter', '@oppenheimer/api', 'migration:run']);
  log('migrations applied');
  const health = `${API_URL}/api/v1/health`;
  if (await httpOk(health)) {
    log(`the API is already answering on ${API_URL}; leaving it`);
    return;
  }
  const out = daemon('api', 'node', ['apps/api/dist/main.js']);
  await waitFor('the API', () => httpOk(health), { logFile: out });
  log(`API on ${API_URL} (log: ${out})`);
}

// oppenheimer:begin web
async function startWeb() {
  if (await httpOk(WEB_URL)) return;
  const out = daemon('web', 'pnpm', ['--filter', '@oppenheimer/web', 'dev']);
  await waitFor('the console', () => httpOk(WEB_URL), { timeout: 120_000, logFile: out });
  log(`console on ${WEB_URL} (log: ${out})`);
}
// oppenheimer:end web

async function up(flags) {
  mkdirSync(STATE, { recursive: true });
  await startInfrastructure();
  ensureEnv();
  await startStub('github-stub', 4319);
  await startStub('namer-stub', 4320);
  await startApi({ build: !flags.has('--no-build') });
  // oppenheimer:begin web
  if (flags.has('--web')) await startWeb();
  // oppenheimer:end web
  log('up. Next: `node scripts/stack/stack.mjs host` for a paired runner');
}

// --------------------------------------------------------------------- the host

/**
 * Who the host runs as. `runner register` refuses root, so as root the host is
 * a dedicated account — which is also what a real machine looks like: the
 * runner, its tmux server and its checkouts belong to one Unix user. As anyone
 * else it is that user, with a HOME of its own under `.stack/` so the runner's
 * identity and checkouts never land in the real one.
 */
function hostAccount() {
  if (!isRoot) {
    return { user: userInfo().username, home: join(STATE, 'host-home') };
  }
  if (!succeeds('id', [HOST_ACCOUNT])) {
    run('useradd', ['--create-home', '--shell', '/bin/bash', HOST_ACCOUNT]);
    log(`created the ${HOST_ACCOUNT} account`);
  }
  return { user: HOST_ACCOUNT, home: `/home/${HOST_ACCOUNT}` };
}

/** argv that runs `argv` as the host, with its HOME and its bin first on PATH. */
function asHost(account, argv) {
  const env = [
    'env',
    `HOME=${account.home}`,
    `PATH=${account.home}/bin:/usr/local/bin:/usr/bin:/bin`,
    ...argv,
  ];
  return isRoot ? ['runuser', ['-u', account.user, '--', ...env]] : [env[0], env.slice(1)];
}

function hostRun(account, ...argv) {
  const [command, args] = asHost(account, argv);
  return run(command, args);
}

function installHostBinaries(account) {
  if (!has('go') || !has('tmux') || !has('git')) fail('the host needs go, tmux and git on PATH');
  const bin = join(account.home, 'bin');
  mkdirSync(bin, { recursive: true });
  run('go', ['build', '-trimpath', '-o', join(bin, 'runner'), './cmd/runner'], {
    cwd: join(ROOT, 'apps', 'runner'),
    env: { ...process.env, CGO_ENABLED: '0' },
  });
  copyFileSync(join(ROOT, 'e2e', 'fleet', 'claude'), join(bin, 'claude'));
  run('chmod', ['+x', join(bin, 'claude')]);
  if (isRoot) run('chown', ['-R', `${account.user}:${account.user}`, account.home]);
  else chownSync(bin, process.getuid(), process.getgid());
  // The runner clones `https://github.com/<owner>/<repo>.git`; here that is
  // the local daemon, as the fleet's `git-server` container is for its hosts.
  hostRun(
    account,
    'git',
    'config',
    '--global',
    'url.git://127.0.0.1/.insteadOf',
    'https://github.com/',
  );
  hostRun(account, 'git', 'config', '--global', 'user.name', 'Stack host');
  hostRun(account, 'git', 'config', '--global', 'user.email', 'host@stack.oppenheimer.test');
}

/** The fleet's git server, rooted under `.stack/` rather than `/tmp`. */
async function startGitServer() {
  if (await portOpen(9418)) return;
  const script = readFileSync(join(ROOT, 'e2e', 'fleet', 'git-server.sh'), 'utf8').replace(
    'root=/tmp/git',
    `root=${join(STATE, 'git')}`,
  );
  rmSync(join(STATE, 'git'), { recursive: true, force: true });
  writeFileSync(join(STATE, 'git-server.sh'), script);
  const out = daemon('git-daemon', 'bash', [join(STATE, 'git-server.sh')]);
  await waitFor('git daemon', () => portOpen(9418), { logFile: out });
}

/** A signed-in API client: the cookie jar is the one header it keeps. */
async function signUp(email) {
  const response = await fetch(`${API_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: WEB_URL },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      name: 'Stack User',
      firstName: 'Stack',
      lastName: 'User',
    }),
  });
  if (!response.ok) fail(`sign-up failed: ${response.status} ${await response.text()}`);
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  return async (method, path, body) => {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { 'content-type': 'application/json', origin: WEB_URL, cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) fail(`${method} ${path} answered ${res.status}: ${text}`);
    return text ? JSON.parse(text) : undefined;
  };
}

async function host(args) {
  if (!(await httpOk(`${API_URL}/api/v1/health`))) fail('the API is not up; run `up` first');
  const existing = readJson(hostFile, null);
  const pids = readJson(pidsFile, {});
  if (existing && pids.runner && alive(pids.runner)) {
    log('a host is already running:');
    console.log(JSON.stringify(existing, null, 2));
    return;
  }
  const nameIndex = args.indexOf('--name');
  const name = nameIndex >= 0 ? args[nameIndex + 1] : `stack-${Date.now().toString(36)}`;
  const account = hostAccount();
  installHostBinaries(account);
  await startGitServer();

  const email = `stack-${Date.now().toString(36)}@stack.oppenheimer.test`;
  const api = await signUp(email);
  // An installation belongs to one workspace, so every host claims a fresh id.
  const githubInstallationId = 900_000_000 + Math.floor(Math.random() * 90_000_000);
  const claim = await fetch(`${GITHUB_STUB_URL}/__stub/installations/${githubInstallationId}`, {
    method: 'PUT',
  });
  if (!claim.ok) fail(`the GitHub stub refused the claim: ${claim.status}`);
  const installation = await api('POST', '/api/v1/installations', {
    githubInstallationId,
    code: 'stub-oauth-code',
  });
  const { installCommand } = await api('POST', '/api/v1/hosts/pairing', { name });
  const token = /--token (\S+)/.exec(installCommand)?.[1];
  if (!token) fail('the pairing answer carried no token');

  // A fresh identity for a fresh account: an old config would pair the host
  // with the account that minted it, not this one.
  rmSync(join(account.home, '.oppenheimer'), { recursive: true, force: true });
  hostRun(account, 'runner', 'register', '--token', token, '--url', API_URL, '--name', name);
  const [command, argv] = asHost(account, ['runner', 'run']);
  const out = daemon('runner', command, argv);

  let hostId;
  await waitFor(
    'the host',
    async () => {
      const rows = await api('GET', '/api/v1/hosts');
      const row = rows.find((r) => r.name === name);
      hostId = row?.id;
      return Boolean(row?.online);
    },
    { logFile: out },
  );
  const record = {
    name,
    hostId,
    installationId: installation.id,
    email,
    password: PASSWORD,
    account: account.user,
    home: account.home,
    runnerLog: out,
  };
  writeFileSync(hostFile, JSON.stringify(record, null, 2));
  log(`host ${name} is online (runner log: ${out})`);
  console.log(JSON.stringify(record, null, 2));
}

// ------------------------------------------------------------------- down, status

function killGroup(pid) {
  for (const signal of ['SIGTERM', 'SIGKILL']) {
    try {
      process.kill(-pid, signal);
    } catch {
      return;
    }
    if (signal === 'SIGTERM') execFileSync('sleep', ['1']);
  }
}

function down(flags) {
  const pids = readJson(pidsFile, {});
  const account = readJson(hostFile, null);
  // The runner first, so the link closes before the API does; dockerd last.
  for (const name of ['runner', 'web', 'api', 'github-stub', 'namer-stub', 'git-daemon']) {
    if (pids[name]) killGroup(pids[name]);
  }
  if (account) {
    // tmux is the runner's sibling and survives it on purpose (02 §12).
    try {
      // The runner's tmux server is on its own socket (`-L oppenheimer`).
      hostRun(
        { user: account.account, home: account.home },
        'tmux',
        '-L',
        'oppenheimer',
        'kill-server',
      );
    } catch {}
  }
  if (succeeds('docker', ['info'])) {
    run('docker', [...COMPOSE, 'down', ...(flags.has('--purge') ? ['-v'] : [])]);
  }
  if (pids.dockerd) killGroup(pids.dockerd);
  if (flags.has('--purge')) {
    if (isRoot && succeeds('id', [HOST_ACCOUNT])) {
      // Whatever the host still runs — a shell a session left behind — holds
      // the account, and userdel refuses a busy one.
      succeeds('pkill', ['-KILL', '-u', HOST_ACCOUNT]);
      execFileSync('sleep', ['1']);
      run('userdel', ['-r', HOST_ACCOUNT]);
    }
    rmSync(STATE, { recursive: true, force: true });
    log('purged: the containers, their volumes, the host account and .stack/');
  } else {
    rmSync(pidsFile, { force: true });
    rmSync(hostFile, { force: true });
    log('down');
  }
}

async function status() {
  const pids = readJson(pidsFile, {});
  const rows = [
    ['docker', succeeds('docker', ['info'])],
    ['postgres', await portOpen(5432)],
    ['redis', await portOpen(6379)],
    ['github-stub', await portOpen(4319)],
    ['namer-stub', await portOpen(4320)],
    ['api', await httpOk(`${API_URL}/api/v1/health`)],
    ['web', await httpOk(WEB_URL)],
    ['git-daemon', await portOpen(9418)],
    ['runner', Boolean(pids.runner && alive(pids.runner))],
  ];
  for (const [name, up] of rows) console.log(`${up ? 'up  ' : 'down'}  ${name}`);
  const record = readJson(hostFile, null);
  if (record) console.log(JSON.stringify(record, null, 2));
}

// ------------------------------------------------------------------------- main

const [command, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith('--')));
switch (command) {
  case 'up':
    await up(flags);
    break;
  case 'host':
    await host(rest);
    break;
  case 'status':
    await status();
    break;
  case 'down':
    down(flags);
    break;
  default:
    console.error(
      'usage: stack.mjs up [--web] [--no-build] | host [--name N] | status | down [--purge]',
    );
    process.exit(2);
}
