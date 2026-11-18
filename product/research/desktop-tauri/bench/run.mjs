#!/usr/bin/env node
// Electron vs Tauri, the same console and the same bench, side by side.
//
//   node bench/run.mjs [--runs 5] [--only electron|tauri]
//
// Needs: the console on OPPENHEIMER_CONSOLE_URL (default http://localhost:3000)
// with BENCH_EMAIL / BENCH_PASSWORD able to sign in, the Electron spike
// installed (`../desktop-spike`, its README), the Tauri spike built
// (`cargo build --release` in `src-tauri`), and Xvfb. Each run gets a fresh
// profile (XDG_* under a temp dir) so every start is cold for the shell.
// Per run it records: wall time from spawn to the console's load event,
// sign-in through the form, the process tree's memory (PSS and RSS, summed
// over every descendant: renderer, GPU and network helpers included) idle
// after sign-in and again after the bridge bench, and the bridge bench itself
// (`page.js`). Prints a JSON line per run and a median table at the end.
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TAURI_DIR = resolve(HERE, '..');
const ELECTRON_DIR = resolve(HERE, '../../desktop-spike');
const CONSOLE_URL = process.env.OPPENHEIMER_CONSOLE_URL ?? 'http://localhost:3000';
const FLOOD_BYTES = 21 * 1024 * 1024;
const args = process.argv.slice(2);
const RUNS = Number(args[args.indexOf('--runs') + 1] || 5) || 5;
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined;
const DISPLAY = ':97';

const account = {
  email: process.env.BENCH_EMAIL ?? 'bench@e2e.oppenheimer.test',
  password: process.env.BENCH_PASSWORD ?? 'Sup3rSecret!Pass',
};

const SHELLS = {
  electron: {
    // The binary itself, not `.bin/electron` (a Node wrapper that would add a
    // process and its start-up to Electron's numbers).
    cmd: join(ELECTRON_DIR, 'node_modules/electron/dist/electron'),
    // Root in a container has no user namespace for Chromium's sandbox.
    args: [
      ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
      join(ELECTRON_DIR, 'src/main.cjs'),
    ],
    cwd: ELECTRON_DIR,
  },
  tauri: {
    cmd: join(TAURI_DIR, 'src-tauri/target/release/oppenheimer-desktop-tauri'),
    args: [],
    cwd: TAURI_DIR,
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Every live descendant of `root`, `root` included. */
function tree(root) {
  const children = new Map();
  for (const name of readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue;
    try {
      const stat = readFileSync(`/proc/${name}/stat`, 'utf8');
      const ppid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
      if (!children.has(ppid)) children.set(ppid, []);
      children.get(ppid).push(Number(name));
    } catch {}
  }
  const out = [];
  const stack = [root];
  while (stack.length) {
    const pid = stack.pop();
    out.push(pid);
    stack.push(...(children.get(pid) ?? []));
  }
  return out;
}

/** PSS and RSS of the whole tree, in MB, and the names of its processes. */
function memory(root) {
  let pss = 0;
  let rss = 0;
  const names = {};
  for (const pid of tree(root)) {
    try {
      const rollup = readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8');
      pss += Number(/^Pss:\s+(\d+)/m.exec(rollup)?.[1] ?? 0);
      rss += Number(/^Rss:\s+(\d+)/m.exec(rollup)?.[1] ?? 0);
      const comm = readFileSync(`/proc/${pid}/comm`, 'utf8').trim();
      names[comm] = (names[comm] ?? 0) + 1;
    } catch {}
  }
  return { pssMB: Math.round(pss / 1024), rssMB: Math.round(rss / 1024), processes: names };
}

function startXvfb() {
  const x = spawn('Xvfb', [DISPLAY, '-screen', '0', '1920x1080x24', '-nolisten', 'tcp'], {
    stdio: 'ignore',
  });
  return x;
}

function startStubRunner(runnerHome) {
  const stub = spawn(process.execPath, [join(HERE, 'stub-runner.mjs')], {
    env: {
      ...process.env,
      RUNNER_HOME: runnerHome,
      WS_FROM: ELECTRON_DIR,
      FLOOD_BYTES: String(FLOOD_BYTES),
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return new Promise((resolveStub) => stub.stdout.once('data', () => resolveStub(stub)));
}

async function runOnce(shell, runnerHome) {
  const { cmd, args: shellArgs, cwd } = SHELLS[shell];
  const profile = mkdtempSync(join(tmpdir(), `bench-${shell}-`));
  const script = join(profile, 'bench.js');
  writeFileSync(
    script,
    readFileSync(join(HERE, 'page.js'), 'utf8')
      .replace('__ACCOUNT__', JSON.stringify(account))
      .replace('__FLOOD_BYTES__', String(FLOOD_BYTES)),
  );
  const env = {
    ...process.env,
    DISPLAY,
    OPPENHEIMER_CONSOLE_URL: CONSOLE_URL,
    OPPENHEIMER_BENCH: script,
    RUNNER_HOME: runnerHome,
    XDG_CONFIG_HOME: join(profile, 'config'),
    XDG_DATA_HOME: join(profile, 'data'),
    XDG_CACHE_HOME: join(profile, 'cache'),
  };
  const t0 = performance.now();
  const child = spawn(cmd, shellArgs, {
    cwd,
    env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const result = { shell };
  let stderr = '';
  child.stderr.on('data', (d) => (stderr += d));

  const done = new Promise((resolveRun, rejectRun) => {
    let buffer = '';
    child.stdout.on('data', (d) => {
      buffer += d;
      let nl = buffer.indexOf('\n');
      while (nl >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf('\n');
        if (line.startsWith('LOADED ') && result.loadMs === undefined) {
          result.loadMs = Math.round(performance.now() - t0);
        } else if (line.startsWith('BENCH ')) {
          const r = JSON.parse(line.slice(6));
          if (r.phase === 'idle') {
            result.signInMs = r.signInMs;
            result.idle = memory(child.pid);
          } else if (r.phase === 'bridge') {
            Object.assign(result, r);
            delete result.phase;
            result.afterBridge = memory(child.pid);
            resolveRun();
          } else rejectRun(new Error(r.error));
        }
      }
    });
    child.on('exit', (code) =>
      rejectRun(new Error(`${shell} exited ${code}: ${stderr.slice(-2000)}`)),
    );
    setTimeout(() => rejectRun(new Error(`${shell} timed out: ${stderr.slice(-2000)}`)), 120_000);
  });
  try {
    await done;
  } finally {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {}
    await sleep(500);
    rmSync(profile, { recursive: true, force: true });
  }
  return result;
}

const median = (xs) => {
  const s = xs.filter((x) => typeof x === 'number').sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : undefined;
};

const xvfb = startXvfb();
await sleep(500);
const runnerHome = mkdtempSync(join(tmpdir(), 'bench-runner-'));
const stub = await startStubRunner(runnerHome);
const shells = ONLY ? [ONLY] : ['electron', 'tauri'];
const results = [];
try {
  // Interleaved, so neither shell always runs on a warmer machine.
  for (let i = 0; i < RUNS; i++) {
    for (const shell of i % 2 ? [...shells].reverse() : shells) {
      const r = await runOnce(shell, runnerHome);
      console.log(JSON.stringify(r));
      results.push(r);
    }
  }
} finally {
  stub.kill();
  xvfb.kill();
  rmSync(runnerHome, { recursive: true, force: true });
}

const rows = [
  ['Spawn to console loaded (ms)', (r) => r.loadMs],
  ['Sign-in through the form (ms)', (r) => r.signInMs],
  ['Memory idle, PSS (MB)', (r) => r.idle?.pssMB],
  ['Memory idle, RSS (MB)', (r) => r.idle?.rssMB],
  ['Bridge attach (ms)', (r) => r.attachMs],
  ['Echo, mean of 300 round trips (µs)', (r) => r.echoMeanUs],
  ['Echo p50 (ms; WebKit clamps to 1 ms)', (r) => r.echoP50],
  ['Echo p95 (ms)', (r) => r.echoP95],
  ['21 MB flood (ms)', (r) => r.floodMs],
  ['Flood throughput (MB/s)', (r) => r.floodMBps],
  ['Echo p50 right after the flood (ms)', (r) => r.afterFloodEchoP50],
  ['Memory after the bench, PSS (MB)', (r) => r.afterBridge?.pssMB],
];
console.log(`\n| Median of ${RUNS} runs | ${shells.join(' | ')} |`);
console.log(`|---|${shells.map(() => '---').join('|')}|`);
for (const [label, pick] of rows) {
  console.log(
    `| ${label} | ${shells.map((s) => median(results.filter((r) => r.shell === s).map(pick)) ?? '—').join(' | ')} |`,
  );
}
