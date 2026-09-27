#!/usr/bin/env node
/**
 * Run the checks a console change has to pass, in the order a reviewer would
 * care about them, and stop at the first that fails.
 *
 *   node .agents/skills/scaffold-feature/scripts/verify-feature.mjs [--module hosts] [--base main]
 *
 * 1. pnpm check:structure: placement, names, the query-stays-home scan and
 *    the tests that pin it
 * 2. dependency-cruiser: the app, plus every frontend package the change
 *    touched
 * 3. Biome: the query-key, skipToken and withCacheOnSuccess plugins included
 * 4. the typecheck: workspace packages built first, since the app reads
 *    their dist/
 * 5. unit tests: the feature's __tests__ (or the whole app) and the touched
 *    packages
 * 6. reports that do not fail the run: the design-system lint (its rules sit
 *    at warn) and the React Compiler's silent bailouts in the files touched
 *
 * A step whose tools are not installed is reported as skipped, never as
 * passed. The summary lists both.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((arg, i, all) => (arg.startsWith('--') ? [arg.slice(2), all[i + 1]] : []))
    .filter((pair) => pair.length),
);

/** The console: the one frontend app, and the package name its scripts run under. */
// oppenheimer:begin web
const APP = { dir: 'apps/web', name: '@oppenheimer/web', features: 'src/features' };
// oppenheimer:end web
/** The frontend packages a change can touch, by directory, with their package names. */
const PACKAGES = {
  'packages/frontend/core': '@oppenheimer/frontend-core',
  'packages/frontend/consumer': '@oppenheimer/frontend-consumer',
  'packages/frontend/web': '@oppenheimer/frontend-web',
  'packages/frontend/design-system/web': '@oppenheimer/design-system-web',
};

// `fileURLToPath`, not `.pathname`: a checkout under a path with a space in it.
const root = fileURLToPath(new URL('../../../../', import.meta.url)).replace(/\/$/, '');
const results = [];

function run(label, command, commandArgs, { cwd = root, report = false } = {}) {
  process.stdout.write(`\n▶ ${label}\n  $ ${[command, ...commandArgs].join(' ')}\n`);
  const result = spawnSync(command, commandArgs, { cwd, stdio: 'inherit', shell: false });
  const ok = result.status === 0;
  results.push({ label, status: ok ? 'passed' : report ? 'reported' : 'FAILED' });
  if (!ok && !report) finish(1);
}

function skip(label, reason) {
  process.stdout.write(`\n▷ ${label}: skipped (${reason})\n`);
  results.push({ label, status: `skipped: ${reason}` });
}

function finish(code) {
  console.log('\nSummary');
  for (const { label, status } of results) console.log(`  ${status.padEnd(9)} ${label}`);
  process.exit(code);
}

/**
 * Whether a tool is installed. The workspace installs hoisted
 * (`node-linker=hoisted`), so a binary is at the root, or beside the package
 * that pins a version of its own.
 */
function installed(name, dir = APP.dir) {
  return [join(root, dir, 'node_modules/.bin', name), join(root, 'node_modules/.bin', name)].some(
    existsSync,
  );
}

/**
 * The files this change touches: the working tree against HEAD (what you are
 * about to commit) plus untracked files. `--base <ref>` widens it to
 * everything since that ref, for a branch with several commits.
 */
function touchedFiles() {
  const since = args.base ?? 'HEAD';
  const diff = spawnSync('git', ['diff', '--name-only', since], { cwd: root, encoding: 'utf8' });
  const untracked = spawnSync('git', ['ls-files', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
  });
  return `${diff.stdout}\n${untracked.stdout}`.split('\n').filter(Boolean);
}

function touchedPackages(files) {
  const packages = new Set();
  for (const file of files) {
    for (const dir of Object.keys(PACKAGES)) if (file.startsWith(`${dir}/`)) packages.add(dir);
  }
  return [...packages];
}

if (!existsSync(join(root, APP.dir))) {
  console.error(`${APP.dir} does not exist in this project.`);
  process.exit(2);
}
if (args.module && !existsSync(join(root, APP.dir, APP.features, args.module))) {
  console.error(`${APP.dir}/${APP.features}/${args.module} does not exist.`);
  process.exit(2);
}

const files = touchedFiles();
const packages = touchedPackages(files);

// 1. structure
run('structure (pnpm check:structure)', 'node', ['scripts/check-frontend-structure.mjs']);
run('structure checker tests', 'node', ['--test', 'scripts/check-frontend-structure.test.mjs']);

// 2. dependency-cruiser, through each package's own `arch` script
if (!installed('depcruise')) {
  skip('dependency-cruiser', 'not installed');
} else {
  run(`arch: ${APP.dir}`, 'pnpm', ['--filter', APP.name, 'arch']);
  for (const dir of packages) {
    if (!existsSync(join(root, dir, '.dependency-cruiser.cjs'))) continue;
    run(`arch: ${dir}`, 'pnpm', ['--filter', PACKAGES[dir], 'arch']);
  }
}

// 3. Biome, over what a console change reaches: the app, the packages it touched, the e2e specs
if (!installed('biome', '.')) {
  skip('biome', 'root dependencies not installed');
} else {
  const e2e = existsSync(join(root, 'e2e')) ? ['e2e'] : [];
  run('biome', 'pnpm', ['exec', 'biome', 'check', APP.dir, ...packages, ...e2e]);
}

// 4. typecheck
if (!installed('tsc')) {
  skip('typecheck', `${APP.dir} dependencies not installed`);
} else {
  run('build workspace dependencies', 'pnpm', ['turbo', 'run', 'build', `--filter=${APP.name}^...`]);
  run(`typecheck: ${APP.dir}`, 'pnpm', ['--filter', APP.name, 'exec', 'tsc', '-b']);
}

// 5. unit tests
if (!installed('vitest')) {
  skip(`tests: ${APP.dir}`, 'vitest not installed');
} else {
  const scope = args.module ? [join(APP.features, args.module)] : [];
  run(`tests: ${APP.dir}${args.module ? ` (${args.module})` : ''}`, 'pnpm', [
    '--filter',
    APP.name,
    'exec',
    'vitest',
    'run',
    '--passWithNoTests',
    ...scope,
  ]);
  for (const dir of packages) run(`tests: ${dir}`, 'pnpm', ['--filter', PACKAGES[dir], 'test']);
}

// 6. reports: they print, they do not fail the run
if (!installed('oxlint')) {
  skip('design-system lint', 'oxlint not installed');
} else {
  run('design-system lint (warnings are findings)', 'pnpm', ['--filter', APP.name, 'lint:design'], {
    report: true,
  });
}
const compiled = spawnSync('node', ['scripts/check-react-compiler.mjs', '--json'], {
  cwd: root,
  encoding: 'utf8',
});
if (compiled.status !== 0) {
  skip('React Compiler bailouts', 'the check could not run');
} else {
  const touched = new Set(files);
  const bailouts = JSON.parse(compiled.stdout).bailouts.filter((b) => touched.has(b.file));
  console.log('\n▶ React Compiler bailouts in the files touched');
  for (const b of bailouts) console.log(`  ${b.file}:${b.line}  ${b.reason}`);
  if (bailouts.length === 0) console.log('  none');
  results.push({
    label: `React Compiler bailouts in touched files: ${bailouts.length}`,
    status: bailouts.length ? 'reported' : 'passed',
  });
}

finish(0);
