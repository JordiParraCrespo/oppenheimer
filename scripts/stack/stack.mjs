#!/usr/bin/env node
/**
 * The stack the e2e suites run against, stood up in one command:
 *
 *   node scripts/stack/stack.mjs up [--web] [--no-build]
 *   node scripts/stack/stack.mjs status
 *   node scripts/stack/stack.mjs down
 *
 * `up` is Postgres and Redis, the GitHub and namer stubs (`e2e/support`), the
 * migrated API and, with `--web`, the console — the steps `e2e/README.md`
 * lists under "Running it", in order. Hosts are the fleet's
 * (`support/fleet.ts`); this starts none.
 *
 * It leaves the checkout's own setup alone:
 *
 * - `.env` is never written. The stubs' configuration (`stub-env.ts`: a GitHub
 *   App and a control-plane key generated for this stack) is kept in
 *   `.stack/stub.env` and handed to the API as environment, which wins over
 *   `.env` (`@oppenheimer/env`). It is generated once, so a restarted API keeps
 *   the key its paired hosts pinned.
 * - Postgres and Redis already listening are used, not replaced; only a
 *   Compose project this script started (`oppenheimer-stack`) is stopped.
 *
 * Everything it starts is recorded in `.stack/`, with a log per process;
 * `down` stops exactly that.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STATE = resolve(process.env.STACK_DIR ?? join(ROOT, '.stack'));
const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';
const COMPOSE = [
  'compose',
  '--project-name',
  'oppenheimer-stack',
  '-f',
  join(ROOT, 'docker', 'docker-compose.dev.yml'),
];
const IMAGES = ['postgres:16-alpine', 'redis:7-alpine'];
/**
 * Docker Hub answers anonymous pulls from a shared address (a cloud sandbox,
 * CI) with 429. These serve the same official images; a pull from one is
 * retagged to the name the Compose file asks for.
 */
const MIRRORS = ['mirror.gcr.io/library/', 'public.ecr.aws/docker/library/'];
const isRoot = process.getuid?.() === 0;

const stateFile = join(STATE, 'state.json');
const stubEnvFile = join(STATE, 'stub.env');

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

function readState() {
  try {
    return JSON.parse(readFileSync(stateFile, 'utf8'));
  } catch {
    return { pids: {}, compose: false };
  }
}

function writeState(state) {
  mkdirSync(STATE, { recursive: true });
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

/**
 * A long-lived process in its own process group, logging to `.stack/<name>.log`.
 * `down` stops the group: `pnpm` puts a child between the pid and the server.
 */
function daemon(name, command, args, env = {}) {
  mkdirSync(STATE, { recursive: true });
  const out = join(STATE, `${name}.log`);
  writeFileSync(out, '');
  const child = spawn('sh', ['-c', 'exec "$@" >>"$0" 2>&1', out, command, ...args], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, ...env },
  });
  child.unref();
  const state = readState();
  state.pids[name] = child.pid;
  writeState(state);
  return out;
}

function portOpen(port) {
  return new Promise((done) => {
    const socket = connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      done(true);
    });
    socket.once('error', () => done(false));
  });
}

async function httpOk(url) {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
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

// --------------------------------------------------------------- Postgres, Redis

/** Whether this call had to start the daemon. */
async function ensureDocker() {
  if (succeeds('docker', ['info'])) return false;
  // A cloud sandbox ships the daemon without starting it.
  if (!isRoot || !succeeds('sh', ['-c', 'command -v dockerd'])) {
    fail('the Docker daemon is not running; start Docker and run this again');
  }
  log('starting dockerd');
  const out = daemon('dockerd', 'dockerd', []);
  await waitFor('dockerd', () => succeeds('docker', ['info']), { timeout: 30_000, logFile: out });
  return true;
}

function ensureImage(image) {
  if (succeeds('docker', ['image', 'inspect', image])) return;
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
  if ((await portOpen(5432)) && (await portOpen(6379))) {
    log('Postgres and Redis are already listening; using them');
    return;
  }
  if (await ensureDocker()) {
    // A daemon that just started brings back containers set to restart —
    // `pnpm docker:dev`'s among them — and those may be the ones listening.
    for (let i = 0; i < 20 && !((await portOpen(5432)) && (await portOpen(6379))); i += 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
    if ((await portOpen(5432)) && (await portOpen(6379))) {
      log('Postgres and Redis came back with the daemon; using them');
      return;
    }
  }
  for (const image of IMAGES) ensureImage(image);
  run('docker', [...COMPOSE, 'up', '-d', '--pull', 'never']);
  writeState({ ...readState(), compose: true });
  // Over TCP: on a fresh volume the image first runs a socket-only server to
  // initialise the database, which answers pg_isready and then goes away.
  await waitFor('Postgres', () =>
    succeeds('docker', [
      ...COMPOSE,
      'exec',
      '-T',
      'postgres',
      'pg_isready',
      '-h',
      '127.0.0.1',
      '-U',
      'oppenheimer',
    ]),
  );
  log('Postgres and Redis are up');
}

// ------------------------------------------------------------------- the API

function parseEnv(file) {
  const env = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    // Verbatim, as `.env` would carry it: the API decodes its own escapes.
    if (match) env[match[1]] = match[2];
  }
  return env;
}

/**
 * What the API runs with on top of the checkout's `.env`: the stubs'
 * configuration, generated once per `.stack/`. A checkout with no `.env` gets
 * `.env.example`'s defaults the same way — as environment, never as a file.
 */
function apiEnv() {
  if (!existsSync(stubEnvFile)) {
    mkdirSync(STATE, { recursive: true });
    writeFileSync(
      stubEnvFile,
      run('node', ['--experimental-strip-types', 'e2e/support/stub-env.ts']),
    );
  }
  const defaults = existsSync(join(ROOT, '.env')) ? {} : parseEnv(join(ROOT, '.env.example'));
  return { ...defaults, ...parseEnv(stubEnvFile) };
}

async function startStub(name, port) {
  if (await portOpen(port)) return;
  const out = daemon(name, 'node', ['--experimental-strip-types', `e2e/support/${name}.ts`]);
  await waitFor(name, () => portOpen(port), { logFile: out });
}

async function startApi(build) {
  const health = `${API_URL}/api/v1/health`;
  if (await httpOk(health)) {
    log(`the API is already answering on ${API_URL}; leaving it`);
    return;
  }
  if (build)
    run('pnpm', ['turbo', 'run', 'build', '--filter=@oppenheimer/api...'], { stdio: 'inherit' });
  const env = apiEnv();
  run('pnpm', ['--filter', '@oppenheimer/api', 'migration:run'], {
    env: { ...process.env, ...env },
  });
  const out = daemon('api', 'node', ['apps/api/dist/main.js'], env);
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

// -------------------------------------------------------------------- commands

async function up(flags) {
  await startInfrastructure();
  await startStub('github-stub', 4319);
  await startStub('namer-stub', 4320);
  await startApi(!flags.has('--no-build'));
  // oppenheimer:begin web
  if (flags.has('--web')) await startWeb();
  // oppenheimer:end web
  log(`up. The API's log is ${join(STATE, 'api.log')}: pass it to the suites as API_LOG`);
}

/** Stop a recorded process group and wait for it to go, killing it at 20 s. */
function stop(pid) {
  const alive = () => {
    try {
      process.kill(-pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  if (!alive()) return;
  process.kill(-pid, 'SIGTERM');
  for (let i = 0; i < 40 && alive(); i += 1) execFileSync('sleep', ['0.5']);
  if (alive()) process.kill(-pid, 'SIGKILL');
}

function down() {
  const state = readState();
  for (const name of ['web', 'api', 'github-stub', 'namer-stub']) {
    if (state.pids[name]) stop(state.pids[name]);
  }
  if (state.compose && succeeds('docker', ['info'])) run('docker', [...COMPOSE, 'down']);
  // Last, and waited for: a daemon still shutting down refuses the next `up`.
  if (state.pids.dockerd) stop(state.pids.dockerd);
  rmSync(stateFile, { force: true });
  log('down');
}

async function status() {
  const rows = [
    ['postgres', await portOpen(5432)],
    ['redis', await portOpen(6379)],
    ['github-stub', await portOpen(4319)],
    ['namer-stub', await portOpen(4320)],
    ['api', await httpOk(`${API_URL}/api/v1/health`)],
    ['web', await httpOk(WEB_URL)],
  ];
  for (const [name, isUp] of rows) console.log(`${isUp ? 'up  ' : 'down'}  ${name}`);
}

const [command, ...rest] = process.argv.slice(2);
const flags = new Set(rest);
// A failed step is one line naming the command and what it printed, not a
// stack trace from inside this script.
process.on('uncaughtException', (error) => {
  const output = [error.stderr, error.stdout].filter(Boolean).join('').trim();
  fail(`${error.message.split('\n')[0]}${output ? `\n${output.slice(-2_000)}` : ''}`);
});
switch (command) {
  case 'up':
    await up(flags);
    break;
  case 'status':
    await status();
    break;
  case 'down':
    down();
    break;
  default:
    console.error('usage: stack.mjs up [--web] [--no-build] | status | down');
    process.exit(2);
}
