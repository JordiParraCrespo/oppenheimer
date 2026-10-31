// The runner, on real child processes. The regressions these guard: jobs
// back to running one after another, a failed step letting the rest of its
// job run, fail-fast leaving steps running (or not stopping at all), and a
// wait on a failed step running anyway.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { runSteps } from './run.mjs';

const node = (job, name, code, extra = {}) => ({
  id: `${job}/${name}`,
  job,
  name,
  command: process.execPath,
  args: ['-e', code],
  ...extra,
});
const sleep = (ms) => `setTimeout(() => {}, ${ms})`;

async function run(steps, options = {}) {
  const logDir = mkdtempSync(join(tmpdir(), 'ci-run-test-'));
  try {
    const rows = await runSteps(steps, { cwd: process.cwd(), logDir, print: () => {}, ...options });
    return Object.fromEntries(rows.map((r) => [r.id, r]));
  } finally {
    rmSync(logDir, { recursive: true, force: true });
  }
}

test('jobs run side by side', async () => {
  const started = Date.now();
  const rows = await run([node('a', 'one', sleep(600)), node('b', 'one', sleep(600))]);
  assert.equal(rows['a/one'].status, 'passed');
  assert.equal(rows['b/one'].status, 'passed');
  assert.ok(Date.now() - started < 1100, 'two 600ms jobs took as long as one after the other');
});

test('a job stops at its first failed step; the others finish without fail-fast', async () => {
  const rows = await run([
    node('a', 'fails', 'process.exit(3)'),
    node('a', 'after', ''),
    node('b', 'slow', sleep(300)),
  ]);
  assert.equal(rows['a/fails'].status, 'failed');
  assert.equal(rows['a/after'].status, 'not run');
  assert.equal(rows['b/slow'].status, 'passed');
});

test('fail-fast stops the steps still running and starts nothing else', async () => {
  const started = Date.now();
  const rows = await run(
    [
      node('a', 'fails', `setTimeout(() => process.exit(1), 100)`),
      node('b', 'long', sleep(20_000)),
      node('b', 'next', ''),
    ],
    { failFast: true },
  );
  assert.equal(rows['a/fails'].status, 'failed');
  assert.equal(rows['b/long'].status, 'stopped');
  assert.equal(rows['b/next'].status, 'not run');
  assert.ok(Date.now() - started < 10_000, 'the long step was left to run');
});

test('a step waits for the steps it names, and does not run when one failed', async () => {
  const rows = await run([
    node(
      'build',
      'build',
      `setTimeout(() => require('fs').writeFileSync('${join(tmpdir(), 'ci-run-built')}', 'x'), 200)`,
    ),
    node(
      'lint',
      'reads the build',
      `require('fs').readFileSync('${join(tmpdir(), 'ci-run-built')}')`,
      {
        after: ['build/build'],
      },
    ),
    node('test', 'broken', 'process.exit(1)'),
    node('suite', 'needs broken', '', { after: ['test/broken'] }),
  ]);
  rmSync(join(tmpdir(), 'ci-run-built'), { force: true });
  assert.equal(rows['lint/reads the build'].status, 'passed');
  assert.equal(rows['suite/needs broken'].status, 'not run');
});

test("a step's output goes to its own log, and a command that cannot start fails", async () => {
  const logDir = mkdtempSync(join(tmpdir(), 'ci-run-test-'));
  try {
    const rows = await runSteps(
      [
        node('a', 'says', 'console.log("hello from a")'),
        { id: 'b/missing', job: 'b', name: 'missing', command: 'no-such-command-here', args: [] },
      ],
      { cwd: process.cwd(), logDir, print: () => {} },
    );
    assert.match(readFileSync(rows[0].log, 'utf8'), /hello from a/);
    assert.equal(rows[1].status, 'failed');
  } finally {
    rmSync(logDir, { recursive: true, force: true });
  }
});

test('an abort stops the run like a failure would', async () => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 150);
  const rows = await run([node('a', 'long', sleep(20_000)), node('a', 'next', '')], {
    signal: controller.signal,
  });
  assert.equal(rows['a/long'].status, 'stopped');
  assert.equal(rows['a/next'].status, 'not run');
});

test('fail-fast waits out a step whose child ignores SIGTERM, and kills it', async () => {
  const pidFile = join(tmpdir(), `ci-run-stubborn-${process.pid}`);
  // The step's own process exits on SIGTERM; the child it started does not.
  const stubborn = `
    const { spawn } = require('child_process');
    const child = spawn(process.execPath, ['-e', 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)'], { stdio: 'ignore' });
    require('fs').writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
    setInterval(() => {}, 1000);`;
  const rows = await run(
    [node('a', 'stubborn', stubborn), node('b', 'fails', `setTimeout(() => process.exit(1), 400)`)],
    { failFast: true },
  );
  const pid = Number(readFileSync(pidFile, 'utf8'));
  rmSync(pidFile, { force: true });
  assert.equal(rows['a/stubborn'].status, 'stopped');
  const alive = (() => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  })();
  assert.equal(alive, false, 'the child that ignored SIGTERM outlived the run');
});
