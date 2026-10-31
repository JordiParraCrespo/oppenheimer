/**
 * Runs a `plan.mjs` step list: every job at once, each job's steps in order,
 * a step that names others in `after` once they have passed. A job stops at
 * its first failed step. With `failFast`, the first failure anywhere stops
 * the run: the steps still running are killed (their whole process group)
 * and nothing else starts.
 *
 * Jobs run side by side, so a step's output goes to its own log,
 * `<logDir>/<job>--<step>.log`, and the terminal gets a line as each step
 * starts and ends, with the end of the log of one that failed. `echo` prints
 * every log whole as its step ends instead (CI, where the run's page is the
 * only place to read them).
 */
import { spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** How a step ended, as the report shows it. */
export const MARKS = {
  passed: '✅',
  failed: '❌',
  skipped: '⏭️',
  stopped: '⏹️ stopped',
  'not run': '➖ not run',
};

const TAIL_LINES = 60;

function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/**
 * @returns {Promise<Array<{ id, job, name, status, seconds, log? }>>} one row
 *   per step, in the order of `steps`
 */
export async function runSteps(
  steps,
  {
    cwd,
    logDir,
    failFast = false,
    echo = false,
    env = process.env,
    print = console.log,
    signal,
  } = {},
) {
  mkdirSync(logDir, { recursive: true });
  const rows = new Map(
    steps.map((s) => [s.id, { id: s.id, job: s.job, name: s.name, status: 'not run', seconds: 0 }]),
  );
  const settled = new Map(steps.map((s) => [s.id, deferred()]));
  const running = new Map();
  /** The steps this run stopped, and the end of each one's process group. */
  const killed = new Map();
  let stopping = false;

  const stopAll = () => {
    if (stopping) return;
    stopping = true;
    for (const [id, child] of running) killed.set(id, stopGroup(child.pid));
  };
  signal?.addEventListener('abort', stopAll, { once: true });

  async function runOne(step) {
    const row = rows.get(step.id);
    const log = join(logDir, `${slug(step.job)}--${slug(step.name)}.log`);
    row.log = log;
    print(`▶ [${step.job}] ${step.name}`);
    const started = Date.now();
    const fd = openSync(log, 'w');
    const code = await new Promise((done) => {
      const child = spawn(step.command, step.args, {
        cwd,
        env: { ...env, ...step.env },
        stdio: ['ignore', fd, fd],
        detached: true,
      });
      running.set(step.id, child);
      child.once('error', (error) => {
        done({ status: 127, error });
      });
      child.once('exit', (status, sig) => done({ status, signal: sig }));
    });
    running.delete(step.id);
    // The step's own process can exit on SIGTERM while something it started
    // ignores it: the run is not over until the whole group is.
    await killed.get(step.id);
    closeSync(fd);
    row.seconds = Math.round((Date.now() - started) / 1000);
    if (code.status === 0) row.status = 'passed';
    // A step this run killed did not fail; whatever its exit code says.
    else row.status = killed.has(step.id) ? 'stopped' : 'failed';
    const output = (() => {
      try {
        return readFileSync(log, 'utf8');
      } catch {
        return '';
      }
    })();
    const text = code.error ? `${output}${code.error.message}\n` : output;
    print(`${MARKS[row.status]} [${step.job}] ${step.name} (${row.seconds}s)`);
    if (echo) print(text);
    else if (row.status === 'failed') {
      const lines = text.trimEnd().split('\n');
      print(`${lines.slice(-TAIL_LINES).join('\n')}\n  (whole log: ${log})`);
    }
    if (row.status === 'failed' && failFast) stopAll();
    return row.status;
  }

  async function runJob(jobSteps) {
    let blocked = false;
    for (const step of jobSteps) {
      const done = settled.get(step.id);
      if (blocked || stopping) {
        done.resolve('not run');
        continue;
      }
      const waits = await Promise.all(
        (step.after ?? []).map((id) => settled.get(id)?.promise ?? 'passed'),
      );
      if (stopping || waits.some((status) => status !== 'passed')) {
        blocked = true;
        done.resolve('not run');
        continue;
      }
      const status = await runOne(step);
      if (status !== 'passed') blocked = true;
      done.resolve(status);
    }
  }

  const jobs = new Map();
  for (const step of steps) {
    if (!jobs.has(step.job)) jobs.set(step.job, []);
    jobs.get(step.job).push(step);
  }
  await Promise.all([...jobs.values()].map(runJob));
  signal?.removeEventListener('abort', stopAll);
  return steps.map((s) => rows.get(s.id));
}

const GRACE_MS = 5_000;

function groupAlive(pgid) {
  try {
    process.kill(-pgid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * A process group, asked to stop and then made to: SIGTERM, then SIGKILL to
 * whatever is left after {@link GRACE_MS}. Resolves once the group is gone
 * (or, for a process that cannot be killed, a moment after SIGKILL).
 */
async function stopGroup(pgid) {
  try {
    process.kill(-pgid, 'SIGTERM');
  } catch {
    return;
  }
  const pause = () => new Promise((r) => setTimeout(r, 100));
  const deadline = Date.now() + GRACE_MS;
  while (groupAlive(pgid) && Date.now() < deadline) await pause();
  if (!groupAlive(pgid)) return;
  try {
    process.kill(-pgid, 'SIGKILL');
  } catch {}
  for (let i = 0; i < 20 && groupAlive(pgid); i += 1) await pause();
}
