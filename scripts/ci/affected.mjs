#!/usr/bin/env node
/**
 * Decides what a CI run has to do from what the branch changed.
 *
 * Given a base (`--base`, as `local.mjs` passes it, or `GITHUB_BASE_REF`),
 * Turborepo's change detection (`turbo ls --affected`) names the workspace
 * packages the diff touches plus everything that depends on them; the jobs
 * then build, test and package only those. No base (the scheduled run on
 * main), or a change to something no package owns but every job relies on
 * (the workflow itself, the lockfile, the Docker context), runs everything —
 * the safety net that keeps a selection mistake on a branch from reaching
 * main.
 *
 * Outputs, written to $GITHUB_OUTPUT (and printed when run by hand):
 *
 *   scope     "all" or "affected"
 *   packages  JSON array of package names to run tasks for
 *   filters   `--filter=<name>` per package, empty when scope is "all"
 *   images    JSON array of apps whose Docker image to build
 *
 *   lint_only JSON array of the changed files only the lint job reads
 *
 *   node scripts/ci/affected.mjs                 # in CI: reads GITHUB_* env
 *   node scripts/ci/affected.mjs --base origin/main   # locally
 *   node scripts/ci/affected.mjs --base origin/main --dirty   # with uncommitted work
 *
 * Which paths outside the packages count, and how, is `selection.mjs`.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { classify } from './selection.mjs';

/** App directory under apps/ → the workspace package the image is built from. */
const IMAGES = {
  api: '@oppenheimer/api',
  // oppenheimer:begin web
  web: '@oppenheimer/web',
  // oppenheimer:end web
  // oppenheimer:begin docs
  docs: '@oppenheimer/docs',
  // oppenheimer:end docs
  // oppenheimer:begin runner
  runner: '@oppenheimer/runner',
  // oppenheimer:end runner
};

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function turboPackages(args, env = {}) {
  const out = execFileSync('pnpm', ['exec', 'turbo', 'ls', '--output=json', ...args], {
    encoding: 'utf8',
    env: { ...process.env, TURBO_TELEMETRY_DISABLED: '1', ...env },
  });
  return JSON.parse(out).packages.items.map((p) => p.name);
}

function baseRef() {
  const flag = process.argv.indexOf('--base');
  if (flag !== -1) return process.argv[flag + 1];
  // Set by GitHub on pull_request events only; the scheduled run has no base.
  const branch = process.env.GITHUB_BASE_REF;
  if (!branch) return null;
  // Make the remote-tracking ref exist and be current, whatever the checkout
  // fetched: both the diff and Turbo's SCM base read it, and a missing ref
  // would fail the job rather than fall back to a full run.
  execFileSync(
    'git',
    ['fetch', '--no-tags', 'origin', `+refs/heads/${branch}:refs/remotes/origin/${branch}`],
    {
      stdio: 'inherit',
    },
  );
  return `origin/${branch}`;
}

const base = baseRef();
const dirty = process.argv.includes('--dirty');
let scope = 'all';
let reason = 'push to the default branch';
let packages;
let lintOnly = [];

/** The files the branch changes: committed, and with `--dirty` uncommitted and untracked too. */
function changedFiles() {
  if (!dirty) return git('diff', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean);
  const since = git('merge-base', base, 'HEAD');
  const tracked = git('diff', '--name-only', since).split('\n');
  const untracked = git('ls-files', '--others', '--exclude-standard').split('\n');
  return [...new Set([...tracked, ...untracked])].filter(Boolean);
}

if (base) {
  const changed = changedFiles();
  const sorted = classify(changed);
  lintOnly = sorted.lintOnly;
  if (sorted.global.length > 0) {
    const { global } = sorted;
    reason = `a change outside every package: ${global.slice(0, 5).join(', ')}${global.length > 5 ? ', …' : ''}`;
  } else {
    scope = 'affected';
    reason = `${changed.length} changed file(s) since ${base}`;
    // Turborepo counts uncommitted files as changed whatever TURBO_SCM_HEAD says.
    packages = turboPackages(['--affected'], { TURBO_SCM_BASE: base, TURBO_SCM_HEAD: 'HEAD' });
    packages = [...new Set([...packages, ...sorted.owners])];
  }
}
if (scope === 'all') packages = turboPackages([]);

packages.sort();
const images = Object.entries(IMAGES)
  .filter(([, pkg]) => packages.includes(pkg))
  .map(([app]) => app);
const filters = scope === 'all' ? '' : packages.map((name) => `--filter=${name}`).join(' ');

const outputs = {
  scope,
  packages: JSON.stringify(packages),
  filters,
  images: JSON.stringify(images),
  lint_only: JSON.stringify(lintOnly),
};

const summary = [
  `**Scope:** ${scope} (${reason})`,
  `**Packages (${packages.length}):** ${packages.join(', ') || 'none'}`,
  `**Images:** ${images.join(', ') || 'none'}`,
].join('\n\n');
console.log(summary);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    Object.entries(outputs)
      .map(([key, value]) => `${key}=${value}\n`)
      .join(''),
  );
}
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## What this run covers\n\n${summary}\n`);
}
