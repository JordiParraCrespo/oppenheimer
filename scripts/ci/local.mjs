#!/usr/bin/env node
/**
 * The CI a change passes before it is pushed, run where the change was made.
 *
 *   pnpm ci:local                      # what the branch touches, against origin/main
 *   pnpm ci:local --all                # everything, as the scheduled run on main does
 *   pnpm ci:local --base origin/feat   # against another base
 *   pnpm ci:local --skip e2e,integration
 *
 * This file is the pipeline. Pull requests get no GitHub CI: every agent
 * runs this before it pushes, and `.github/workflows/ci.yml` runs
 * `pnpm ci:local --all` on main every eight hours, so the report a pull
 * request carries and the scheduled run are the same program. A new CI step
 * goes here and nowhere else. The jobs, chosen by `affected.mjs`:
 *
 *   lint         Biome, the design-system lint, architecture, structure, flags
 *   go           vet, golangci-lint, tests, the runner for every target
 *   test         build, generated files committed, unit tests, bundle budget
 *   integration  the API's suite (Testcontainers, so Docker)
 *   e2e          the API suite against the stack
 *
 * Integration and e2e run after `scripts/stack/stack.mjs up`, and the stack
 * comes down when they finish.
 *
 * It runs on the commit checked out, so commit first; it refuses a tree with
 * uncommitted changes to tracked files. A job stops at its first failed step;
 * the other jobs still run. The report
 * (HEAD, base, one row per step) is printed and written to
 * `.ci-local/report.md` — paste it into the pull request. The exit code is
 * non-zero when any step failed.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, '.ci-local');
const JOBS = ['lint', 'go', 'test', 'integration', 'e2e'];

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : (args[at + 1] ?? '');
};
const all = args.includes('--all');
const base = all ? null : (flag('--base') ?? 'origin/main');
const skip = new Set((flag('--skip') ?? '').split(',').filter(Boolean));
for (const job of skip) {
  if (!JOBS.includes(job)) {
    console.error(`ci:local: unknown job "${job}" in --skip; jobs are ${JOBS.join(', ')}`);
    process.exit(2);
  }
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
  execFileSync('node', ['scripts/ci/affected.mjs', ...(base ? ['--base', base] : [])], {
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
  };
}

// ---------------------------------------------------------------------- steps

const rows = [];

/**
 * Runs one step with its output inherited; returns whether it passed. A step
 * is a command, or a function that returns whether it passed.
 */
function step(job, name, command, commandArgs, options = {}) {
  console.log(`\n▶ [${job}] ${name}`);
  const started = Date.now();
  const ok =
    typeof command === 'function'
      ? command()
      : spawnSync(command, commandArgs, {
          cwd: ROOT,
          stdio: 'inherit',
          env: { ...process.env, ...options.env },
        }).status === 0;
  rows.push({ job, name, ok, seconds: Math.round((Date.now() - started) / 1000) });
  return ok;
}

/** Runs a job's steps in order, stopping at the first failure. */
function job(name, steps) {
  if (skip.has(name)) {
    rows.push({ job: name, name: 'skipped with --skip', ok: null, seconds: 0 });
    return;
  }
  for (const [label, command, commandArgs, options] of steps) {
    if (!step(name, label, command, commandArgs, options)) return;
  }
}

const touches = (packages, name) => packages.includes(name);

// ----------------------------------------------------------------------- run

// The report names a commit, and the selection diffs commits: uncommitted
// changes would be run but not selected for, or selected for but not in the
// commit the report names. Commit first.
if (git('status', '--porcelain', '--untracked-files=no') !== '') {
  console.error(
    'ci:local: commit your changes first; the report is for a commit, and the selection reads commits.',
  );
  console.error(git('status', '--short', '--untracked-files=no'));
  process.exit(2);
}
const head = git('rev-parse', 'HEAD');
const { scope, packages, filters } = selection();
const any = packages.length > 0;

/** The working tree as it stands, so a rewrite of any file shows. */
const tree = () => `${git('status', '--porcelain')}\n${git('diff')}`;

// lint — always, like the workflow's.
const before = tree();
job('lint', [
  ['pnpm check', 'pnpm', ['check']],
  // The workflow's `pnpm check` rewrites what it can fix and passes; here a
  // rewrite is a failure, because the fix is not in the commit yet.
  [
    'Biome left nothing to commit',
    () => {
      if (tree() === before) return true;
      console.log('Biome rewrote files; review and commit them:');
      console.log(git('status', '--short'));
      return false;
    },
  ],
  ['pnpm check:biome-plugins', 'pnpm', ['check:biome-plugins']],
  // oppenheimer:begin web|web-showcase
  ['Design-system lint (reports, never fails)', 'pnpm', ['lint:design']],
  // oppenheimer:end web|web-showcase
  ...(any ? [['Architecture boundaries', 'pnpm', ['turbo', 'run', 'arch', ...filters]]] : []),
  ['API structure', 'pnpm', ['check:api-structure']],
  ['Feature flags', 'pnpm', ['check:flags']],
  // oppenheimer:begin web
  ['Frontend structure', 'pnpm', ['check:structure']],
  // oppenheimer:end web
  // oppenheimer:begin starter
  ['Starter manifest', 'pnpm', ['starter:check']],
  // oppenheimer:end starter
]);

// oppenheimer:begin runner
if (
  packages.some((p) => p.startsWith('@oppenheimer/go-')) ||
  touches(packages, '@oppenheimer/runner')
) {
  job('go', [
    ['go vet', 'go', ['vet', 'github.com/jordiparracrespo/oppenheimer/...']],
    ['golangci-lint', 'sh', ['-c', `golangci-lint run $(go list -m -f '{{.Dir}}/...')`]],
    ['go test', 'go', ['test', '-count=1', 'github.com/jordiparracrespo/oppenheimer/...']],
    [
      'build the runner',
      'sh',
      ['-c', 'cd apps/runner && go build -trimpath -o /dev/null ./cmd/runner'],
    ],
    ...['darwin/arm64', 'darwin/amd64', 'linux/arm64'].map((target) => {
      const [goos, goarch] = target.split('/');
      return [
        `build for ${target}`,
        'sh',
        ['-c', `cd apps/runner && GOOS=${goos} GOARCH=${goarch} go build -o /dev/null ./...`],
      ];
    }),
  ]);
}
// oppenheimer:end runner

if (any) {
  job('test', [
    ['turbo build', 'pnpm', ['turbo', 'run', 'build', ...filters]],
    // oppenheimer:begin runner
    ...(touches(packages, '@oppenheimer/shared') || touches(packages, '@oppenheimer/runner')
      ? [
          [
            'Generated files are committed',
            'pnpm',
            ['--filter', '@oppenheimer/shared', 'run', 'check:generated'],
          ],
          [
            'Generated files unchanged',
            'git',
            [
              'diff',
              '--exit-code',
              '--',
              'packages/shared/protocol-schema',
              'apps/runner/internal',
            ],
          ],
        ]
      : []),
    // oppenheimer:end runner
    ['turbo test', 'pnpm', ['turbo', 'run', 'test', ...filters]],
    // oppenheimer:begin web
    ...(touches(packages, '@oppenheimer/web')
      ? [
          ['build the web app', 'pnpm', ['turbo', 'run', 'build', '--filter=@oppenheimer/web']],
          ['First-load budgets', 'pnpm', ['check:bundle']],
        ]
      : []),
    // oppenheimer:end web
  ]);
}

const needsIntegration = touches(packages, '@oppenheimer/api') && !skip.has('integration');
// oppenheimer:begin e2e
const needsE2e =
  (touches(packages, '@oppenheimer/api') || touches(packages, '@oppenheimer/e2e')) &&
  !skip.has('e2e');
// oppenheimer:end e2e
for (const name of ['integration', 'e2e']) if (skip.has(name)) job(name, []);

// Both suites need the stack's services: `stack.mjs up` uses a Postgres and
// Redis already listening (the workflow's service containers), and otherwise
// starts them under Docker, starting the daemon in a sandbox that ships it
// stopped. Testcontainers then needs that same daemon, so where Postgres and
// Redis run outside Docker, Docker still has to be running.
if (needsIntegration || needsE2e) {
  try {
    if (step('services', 'stack up', 'node', ['scripts/stack/stack.mjs', 'up'])) {
      if (needsIntegration) {
        job('integration', [
          ['build the API', 'pnpm', ['turbo', 'run', 'build', '--filter=@oppenheimer/api...']],
          // Ryuk is one more image to pull from Docker Hub; every suite
          // stops its own containers.
          [
            'pnpm test:integration',
            'pnpm',
            ['test:integration'],
            { env: { TESTCONTAINERS_RYUK_DISABLED: 'true' } },
          ],
        ]);
      }
      // oppenheimer:begin e2e
      if (needsE2e) job('e2e', [['e2e:api', 'pnpm', ['--filter', '@oppenheimer/e2e', 'e2e:api']]]);
      // oppenheimer:end e2e
    }
  } finally {
    spawnSync('node', ['scripts/stack/stack.mjs', 'down'], { cwd: ROOT, stdio: 'inherit' });
  }
}

// -------------------------------------------------------------------- report

const failed = rows.filter((r) => r.ok === false);
const mark = (ok) => (ok === null ? '⏭️' : ok ? '✅' : '❌');
const report = [
  `### Local CI ${failed.length ? '❌ failed' : '✅ passed'}`,
  '',
  `\`pnpm ci:local${args.length ? ` ${args.join(' ')}` : ''}\` on \`${head.slice(0, 12)}\`, ` +
    `${base ? `against \`${base}\`` : 'every package'}; scope **${scope}**, ${packages.length} package(s).`,
  '',
  '| Job | Step | Result | Time |',
  '| --- | --- | --- | --- |',
  ...rows.map((r) => `| ${r.job} | ${r.name} | ${mark(r.ok)} | ${r.seconds}s |`),
  '',
].join('\n');
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'report.md'), report);
console.log(`\n${report}`);
console.log(`Report written to ${join('.ci-local', 'report.md')}.`);
process.exit(failed.length ? 1 : 0);
