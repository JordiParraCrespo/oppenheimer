// The architecture check's decisions, for the Stop hook `arch-check.sh`:
// which packages to cruise, how, and what blocks the stop. It prints the
// hook's answer (a `block` with the violations, or a `systemMessage`) and
// nothing when the stop may go ahead. `pnpm ci:local` still runs all of
// `pnpm arch`; this is the in-loop subset.
//
// - The packages are found, not listed: every directory with a
//   `.dependency-cruiser.cjs` (apps/api/ARCHITECTURE.md,
//   packages/frontend/ARCHITECTURE.md). One is cruised when its `src/`, its
//   config, or the shared rules in `packages/tsconfig/depcruise` its config
//   loads have uncommitted changes.
// - depcruise runs directly, not through turbo, whose `^build` costs minutes
//   on a checkout with nothing built. The rules only need the workspace
//   packages' `dist/` to exist, so imports resolve to `packages/<name>/`.
//   When one a package reaches has never been built, that package goes
//   through `pnpm turbo run arch --filter`, which builds it first.
// - A package that passed is not cruised again until its changes do: the
//   fingerprint is HEAD, the diff, and the path and content of every
//   untracked file, since the rules are about where a file sits.
// - The API and frontend layout contracts run for the side that changed.
//
// Cases are in `.agents/hooks/arch-check.test.mjs` (the decisions) and
// `.agents/hooks/shell-hooks.test.mjs` (the hook end to end).

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG = '.dependency-cruiser.cjs';
const SHARED_RULES = 'packages/tsconfig/depcruise';

function git(root, args, input) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    input,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'ignore'],
    maxBuffer: 256 * 1024 * 1024,
  });
}

/**
 * Every package with a depcruise config: `{ dir, watch, frontend }`, where
 * `watch` are the paths whose change re-runs it and `frontend` says its rules
 * are the frontend tier's.
 */
export function discoverPackages(root) {
  return git(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z', `*${CONFIG}`])
    .split('\0')
    .filter((path) => path === CONFIG || path.endsWith(`/${CONFIG}`))
    .filter((path, i, all) => all.indexOf(path) === i && existsSync(join(root, path)))
    .map((path) => {
      const dir = dirname(path);
      const config = readFileSync(join(root, path), 'utf8');
      const watch = [join(dir, 'src'), path];
      if (config.includes('tsconfig/depcruise')) watch.push(SHARED_RULES);
      return { dir, watch, frontend: config.includes('depcruise/frontend-') };
    })
    .sort((a, b) => a.dir.localeCompare(b.dir));
}

/** The paths with uncommitted changes, untracked files included. */
export function changedPaths(root) {
  const entries = git(root, ['status', '--porcelain', '-z', '--untracked-files=all']).split('\0');
  const paths = [];
  for (let i = 0; i < entries.length; i += 1) {
    if (!entries[i]) continue;
    paths.push(entries[i].slice(3));
    // A rename or copy is `R  new\0old`: the old path is the next entry.
    if (/^[RC]/.test(entries[i])) paths.push(entries[++i]);
  }
  return paths;
}

/** Whether any of `paths` is one of `watch` or under it. */
export function touches(paths, watch) {
  return paths.some((path) => watch.some((w) => path === w || path.startsWith(`${w}/`)));
}

/** A fingerprint of the uncommitted state under `watch`. */
export function fingerprint(root, watch) {
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard', '-z', '--', ...watch])
    .split('\0')
    .filter(Boolean);
  const blobs = untracked.length
    ? git(root, ['hash-object', '--', ...untracked]).trim().split('\n')
    : [];
  const state = [
    git(root, ['rev-parse', 'HEAD']),
    git(root, ['diff', 'HEAD', '--', ...watch]),
    ...untracked.map((path, i) => `${path}\0${blobs[i]}\n`),
  ].join('');
  return git(root, ['hash-object', '--stdin'], state).trim();
}

/**
 * Whether every workspace package `dir` reaches, directly or through another,
 * that builds to a `dist/` has one, so depcruise can resolve it.
 */
export function depsBuilt(dir, seen = new Set()) {
  const real = realpathSync(dir);
  if (seen.has(real)) return true;
  const first = seen.size === 0;
  seen.add(real);
  const pkg = JSON.parse(readFileSync(join(real, 'package.json'), 'utf8'));
  const toDist = JSON.stringify([pkg.exports, pkg.main]).includes('dist/');
  if (!first && pkg.scripts?.build && toDist && !existsSync(join(real, 'dist'))) return false;
  const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
  for (const [name, range] of Object.entries(deps)) {
    if (!String(range).startsWith('workspace:')) continue;
    const target = join(real, 'node_modules', name);
    if (!existsSync(target) || !depsBuilt(target, seen)) return false;
  }
  return true;
}

function stampOf(root, dir) {
  const state = join(git(root, ['rev-parse', '--absolute-git-dir']).trim(), 'arch-check');
  mkdirSync(state, { recursive: true });
  return join(state, dir.replaceAll('/', '_'));
}

function read(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/**
 * What this stop checks: `cruise` (built, with the stamp to write on a pass),
 * `unbuilt` (through turbo), and which layout contracts run.
 */
export function plan(root) {
  const changed = changedPaths(root);
  const result = {
    cruise: [],
    unbuilt: [],
    apiStructure: touches(changed, ['apps/api/src']),
    frontendStructure: touches(changed, ['packages/frontend']),
  };
  for (const pkg of discoverPackages(root)) {
    if (!touches(changed, pkg.watch)) continue;
    if (pkg.frontend) result.frontendStructure = true;
    const key = fingerprint(root, pkg.watch);
    const stamp = stampOf(root, pkg.dir);
    if (read(stamp) === key) continue;
    if (depsBuilt(join(root, pkg.dir))) result.cruise.push({ dir: pkg.dir, key, stamp });
    else result.unbuilt.push(pkg.dir);
  }
  return result;
}

function exec(command, args, cwd) {
  return new Promise((done) => {
    let output = '';
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.on('error', (error) => done({ ok: false, output: String(error) }));
    child.on('close', (code) => done({ ok: code === 0, output: output.trim() }));
  });
}

/** The hook's answer for the checkout at `root`, or null to let the stop go ahead. */
export async function check(root) {
  const work = plan(root);
  const jobs = [];
  if (work.cruise.length + work.unbuilt.length > 0) {
    const depcruise = join(root, 'node_modules/.bin/depcruise');
    if (!existsSync(depcruise)) {
      return {
        systemMessage:
          'Architecture check skipped: dependency-cruiser is not installed (run `pnpm install --frozen-lockfile`).',
      };
    }
    for (const { dir, key, stamp } of work.cruise) {
      jobs.push(
        exec(depcruise, ['src', '--config', CONFIG], join(root, dir)).then((result) => {
          if (result.ok) writeFileSync(stamp, key);
          return { ...result, label: dir };
        }),
      );
    }
    if (work.unbuilt.length > 0) {
      const filters = work.unbuilt.map((dir) => `--filter=./${dir}`);
      jobs.push(
        exec('pnpm', ['turbo', 'run', 'arch', '--output-logs=errors-only', ...filters], root).then(
          (result) => ({ ...result, label: work.unbuilt.join(', ') }),
        ),
      );
    }
  }
  for (const [wanted, script] of [
    [work.apiStructure, 'scripts/check-api-structure.mjs'],
    [work.frontendStructure, 'scripts/check-frontend-structure.mjs'],
  ]) {
    if (wanted && existsSync(join(root, script))) {
      jobs.push(exec(process.execPath, [script], root).then((r) => ({ ...r, label: script })));
    }
  }
  const failed = (await Promise.all(jobs)).filter((result) => !result.ok);
  if (failed.length === 0) return null;
  const details = failed.map(({ label, output }) => `${label}\n${output}`).join('\n\n');
  return {
    decision: 'block',
    reason: `Architecture check failed. Fix these boundary violations before finishing — see the ARCHITECTURE.md of what you changed:\n\n${details}`,
  };
}

async function main() {
  let root;
  try {
    root = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
  } catch {
    return;
  }
  const answer = await check(root);
  if (answer) process.stdout.write(`${JSON.stringify(answer)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
