#!/usr/bin/env node
/**
 * The CI a change passes before it is pushed, run where the change was made.
 *
 *   pnpm ci:local                      # what the branch touches, against origin/main
 *   pnpm ci:local --all                # everything, as the scheduled run on main does
 *   pnpm ci:local --base origin/feat   # against another base
 *   pnpm ci:local --skip e2e,integration
 *   pnpm ci:local --dirty              # the lint job on uncommitted work, before a commit
 *   pnpm ci:local --no-fail-fast       # finish every job even after a failure
 *
 * This file is the pipeline's command line. Pull requests get no GitHub CI:
 * every agent runs this before it pushes, and `.github/workflows/ci.yml` runs
 * `pnpm ci:local --all` on main every eight hours, so the report a pull
 * request carries and the scheduled run are the same program. A new CI step
 * goes in `plan.mjs` and nowhere else. The jobs, chosen by `affected.mjs`:
 *
 *   lint         Biome, the design-system lint, architecture, typecheck,
 *                structure, flags, React singletons (one installed copy each),
 *                compiler bail-outs, unused code, translations, the hexagon eval's anchors,
 *                this pipeline's own tests, starter manifest
 *   evals        the frontend audit eval's fixtures (a full run, or its cases changed)
 *   go           vet, golangci-lint, tests, the runner for every target
 *   test         build, backend public API, generated files committed, unit tests, bundle budget
 *   services     the stack's Postgres, Redis and stubs, then the API built here
 *   integration  the API's suite (Testcontainers, so Docker)
 *   e2e          the API suite against the stack
 *
 * The jobs run side by side (`run.mjs`); the services start while the build
 * runs, and the suites once the API is up. A stack that was already up (a
 * console from `stack.mjs up --web`, for the screenshots) stays up with this
 * commit's API in it; one this run started comes down at the end.
 *
 * It runs on the commit checked out, so commit first; it refuses a tree with
 * any uncommitted change, untracked files included. A job stops at its first
 * failed step, and the first failure stops the run (fail-fast), except with
 * `--all` or `--no-fail-fast`, where every other job runs to its end. The
 * report (HEAD, base, one row per step) is printed and written to
 * `.ci-local/report.md` — paste it into the pull request; each step's output
 * is in `.ci-local/logs/`. The exit code is non-zero when any step failed.
 *
 * `--dirty` is the quick check while working: the lint job only, on the tree
 * as it is, uncommitted files included. Its report goes to
 * `.ci-local/dirty-report.md`, says it is not for a pull request, and leaves
 * `report.md` alone.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plan, SKIPPABLE, teardown } from './plan.mjs';
import { MARKS, runSteps } from './run.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, '.ci-local');

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : (args[at + 1] ?? '');
};
const all = args.includes('--all');
const dirty = args.includes('--dirty');
const failFast = !all && !args.includes('--no-fail-fast');
const base = all ? null : (flag('--base') ?? 'origin/main');
const skip = new Set((flag('--skip') ?? '').split(',').filter(Boolean));
for (const job of skip) {
  if (!SKIPPABLE.includes(job)) {
    console.error(`ci:local: unknown job "${job}" in --skip; jobs are ${SKIPPABLE.join(', ')}`);
    process.exit(2);
  }
}
if (all && dirty) {
  console.error('ci:local: --dirty checks the work in hand against a base; it does not take --all');
  process.exit(2);
}

function git(...gitArgs) {
  return execFileSync('git', gitArgs, { cwd: ROOT, encoding: 'utf8' }).trim();
}

// ------------------------------------------------------------------ selection

/** `affected.mjs`'s outputs, exactly as the workflow reads them. */
function selection() {
  if (base?.startsWith('origin/')) {
    const branch = base.slice('origin/'.length);
    execFileSync(
      'git',
      ['fetch', '--no-tags', 'origin', `+refs/heads/${branch}:refs/remotes/origin/${branch}`],
      { cwd: ROOT, stdio: 'inherit' },
    );
  }
  const dir = mkdtempSync(join(tmpdir(), 'ci-local-'));
  const output = join(dir, 'output');
  writeFileSync(output, '');
  const env = { ...process.env, GITHUB_OUTPUT: output };
  delete env.GITHUB_BASE_REF;
  delete env.GITHUB_STEP_SUMMARY;
  const affectedArgs = [...(base ? ['--base', base] : []), ...(dirty ? ['--dirty'] : [])];
  execFileSync('node', ['scripts/ci/affected.mjs', ...affectedArgs], {
    cwd: ROOT,
    env,
    stdio: 'inherit',
  });
  const outputs = Object.fromEntries(
    readFileSync(output, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  );
  rmSync(dir, { recursive: true, force: true });
  return {
    scope: outputs.scope,
    packages: JSON.parse(outputs.packages),
    filters: outputs.filters ? outputs.filters.split(' ') : [],
    lintOnly: JSON.parse(outputs.lint_only ?? '[]'),
  };
}

// ----------------------------------------------------------------------- run

// The report names a commit, and the selection diffs commits: uncommitted
// changes would be run but not selected for, or selected for but not in the
// commit the report names. An untracked file counts: a build or a test can
// read it, and it will not be pushed. Commit first, or ignore it.
if (!dirty && git('status', '--porcelain') !== '') {
  console.error(
    'ci:local: commit your changes first (or ignore the file); the report is for a commit, and the selection reads commits. `--dirty` checks uncommitted work, lint only.',
  );
  console.error(git('status', '--short'));
  process.exit(2);
}
const head = git('rev-parse', 'HEAD');
const chosen = selection();
const steps = plan(chosen, { dirty, skip });
// A console up before this run (`stack.mjs up --web`, for the screenshots)
// is in use: the run swaps the API and leaves the rest up.
const keepStack = (() => {
  try {
    return Boolean(JSON.parse(readFileSync(join(ROOT, '.stack', 'state.json'), 'utf8')).pids?.web);
  } catch {
    return false;
  }
})();

const logDir = join(OUT, dirty ? 'dirty-logs' : 'logs');
rmSync(logDir, { recursive: true, force: true });
const aborted = new AbortController();
process.once('SIGINT', () => aborted.abort());
process.once('SIGTERM', () => aborted.abort());
const started = Date.now();
let rows;
try {
  rows = await runSteps(steps, {
    cwd: ROOT,
    logDir,
    failFast,
    // In GitHub Actions the run's page is the only place to read a log.
    echo: Boolean(process.env.GITHUB_ACTIONS),
    signal: aborted.signal,
  });
} finally {
  const down = teardown(steps, { keepStack });
  if (down) spawnSync(down[0], down[1], { cwd: ROOT, stdio: 'inherit' });
}
const wall = Math.round((Date.now() - started) / 1000);

// -------------------------------------------------------------------- report

for (const job of skip)
  rows.push({ job, name: 'skipped with --skip', status: 'skipped', seconds: 0 });
const failed = rows.filter((r) => r.status === 'failed');
const passed = failed.length === 0 && !aborted.signal.aborted;
const verdict = aborted.signal.aborted ? '⏹️ interrupted' : passed ? '✅ passed' : '❌ failed';
const report = [
  dirty
    ? `### Quick check ${verdict} — uncommitted work, lint only; not a pull request's report`
    : `### Local CI ${verdict}`,
  '',
  `\`pnpm ci:local${args.length ? ` ${args.join(' ')}` : ''}\` on \`${head.slice(0, 12)}\`` +
    `${dirty ? ' plus uncommitted changes' : ''}, ` +
    `${base ? `against \`${base}\`` : 'every package'}; scope **${chosen.scope}**, ` +
    `${chosen.packages.length} package(s); ${wall}s wall clock` +
    `${failFast ? ', fail-fast' : ''}.`,
  '',
  '| Job | Step | Result | Time |',
  '| --- | --- | --- | --- |',
  ...rows.map((r) => `| ${r.job} | ${r.name} | ${MARKS[r.status]} | ${r.seconds}s |`),
  '',
].join('\n');
mkdirSync(OUT, { recursive: true });
const reportFile = dirty ? 'dirty-report.md' : 'report.md';
writeFileSync(join(OUT, reportFile), report);
console.log(`\n${report}`);
console.log(`Report written to ${join('.ci-local', reportFile)}; step logs in ${logDir}.`);
process.exit(passed ? 0 : 1);
