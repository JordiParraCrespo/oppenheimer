#!/usr/bin/env node
// Does an agent that launches a feature behind a flag launch it on?
//
// Every boolean flag defaults to `true` (`.agents/rules/feature-flags.md`):
// a feature ships on, and its flag is how it is turned off or narrowed. Each
// task is a ticket that asks for a feature behind a new flag, worded the way
// a person would ("not sure people want it", "still in beta", "roll it out
// gradually"), and says nothing about the default. The agent works in a
// throwaway git worktree of `--ref` (default HEAD) with `scripts/evals`
// deleted, so the references and controls below are out of its reach.
//
// Afterwards the grader, in the worktree:
//   catalog   the flags the change adds, read from the catalog before and after
//   default   every new boolean flag defaults to `true` (the headline)
//   existing  no flag already in the catalog had its default changed
//   reads     the new flag is read where the ticket gates it: the console
//             (`useFeatureFlag`) and/or the API (`@RequireFlag`, `isEnabled`),
//             and a server-only flag is declared `client: false`
//   checks    `pnpm check:flags` with the grader's own copy of the script
//   build     the shared package builds, and each app the task touches typechecks
//
//   node scripts/evals/feature-flags/run.mjs                        every task, the agent
//   node scripts/evals/feature-flags/run.mjs --task host-copy-id    one task
//   node scripts/evals/feature-flags/run.mjs --trials 3             each task three times
//   node scripts/evals/feature-flags/run.mjs --ref origin/main      the agent against other rules
//   node scripts/evals/feature-flags/run.mjs --reference            the reference patches (must score 100%)
//   node scripts/evals/feature-flags/run.mjs --control              the known-bad overlays (each check fails under one)
//   node scripts/evals/feature-flags/run.mjs --task <id> --patch <file>   grade a saved diff
//   options: --model <id> (default claude-sonnet-5-5), --keep (leave the worktree), --timeout <minutes>
import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: HERE,
  encoding: 'utf8',
}).trim();
const CATALOG = 'packages/shared/src/feature-flags/catalog.ts';
// The grader's own inputs: copied in from this checkout before checking, so an
// agent that edits them changes its diff, not its score.
const GRADER_FILES = ['scripts/check-feature-flags.mjs'];
const CLIENT_DIRS = /^(apps\/web\/src|packages\/frontend\/[^/]+\/src)\//;
const SERVER_DIRS = /^apps\/api\/src\//;
const TEST_FILE = /(\.spec|\.test)\.[cm]?[jt]sx?$|\/__tests__\//;
const APPS = {
  client: {
    filter: '@oppenheimer/web',
    typecheck: ['exec', 'tsc', '-p', 'tsconfig.json', '--noEmit'],
  },
  // The build config: the API's specs lean on Vitest globals its tsconfig leaves out.
  server: {
    filter: '@oppenheimer/api',
    typecheck: ['exec', 'tsc', '-p', 'tsconfig.build.json', '--noEmit'],
  },
};
const AGENT_TOOLS = [
  'Read',
  'Edit',
  'Write',
  'Glob',
  'Grep',
  'Bash(pnpm:*)',
  'Bash(npx:*)',
  'Bash(node:*)',
  'Bash(git status:*)',
  'Bash(git diff:*)',
  'Bash(ls:*)',
  'Bash(cat:*)',
  'Bash(grep:*)',
  'Bash(sed -n:*)',
].join(',');

function parseArgs(argv) {
  const args = {
    model: 'claude-sonnet-5-5',
    timeout: 30,
    mode: 'agent',
    keep: false,
    task: null,
    trials: 1,
    ref: 'HEAD',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--task') args.task = argv[++i];
    else if (arg === '--model') args.model = argv[++i];
    else if (arg === '--timeout') args.timeout = Number(argv[++i]);
    else if (arg === '--trials') args.trials = Number(argv[++i]);
    else if (arg === '--ref') args.ref = argv[++i];
    else if (arg === '--keep') args.keep = true;
    else if (arg === '--reference') args.mode = 'reference';
    else if (arg === '--control') args.mode = 'control';
    else if (arg === '--patch') {
      args.mode = 'patch';
      args.patch = resolve(argv[++i]);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (args.mode === 'patch' && !args.task) throw new Error('--patch needs --task');
  return args;
}

function run(cmd, cmdArgs, cwd, { timeoutMs = 15 * 60_000 } = {}) {
  const result = spawnSync(cmd, cmdArgs, {
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout,
    out: `${result.stdout}${result.stderr}`,
  };
}

function log(message) {
  process.stderr.write(`${message}\n`);
}

// One worktree for the whole run, installed and built once; `resetWorktree`
// puts it back between tasks and keeps the git-ignored node_modules and dist.
function prepareWorktree(dir, ref) {
  const added = run('git', ['worktree', 'add', '--detach', dir, ref], ROOT);
  if (!added.ok) throw new Error(`git worktree add failed:\n${added.out}`);
  log(`worktree ${dir} at ${ref}`);
  hideEvals(dir);
  const install = run('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], dir);
  if (!install.ok) throw new Error(`pnpm install failed:\n${install.out.slice(-2000)}`);
  const deps = buildDeps(dir, Object.keys(APPS));
  if (!deps.ok)
    throw new Error(`building the apps' dependencies failed:\n${deps.out.slice(-2000)}`);
}

/** The packages the apps typecheck against (shared, translations…), built; cached by turbo. */
function buildDeps(dir, surfaces) {
  const filters = surfaces.map((surface) => `--filter=${APPS[surface].filter}^...`);
  return run('pnpm', ['turbo', 'run', 'build', ...filters], dir);
}

// The agent must not see the references or the controls.
function hideEvals(dir) {
  rmSync(join(dir, 'scripts/evals'), { recursive: true, force: true });
}

function resetWorktree(dir) {
  const reset = run('git', ['reset', '--hard', '-q', 'HEAD'], dir);
  const clean = run('git', ['clean', '-fdq'], dir);
  if (!reset.ok || !clean.ok) throw new Error(`resetting ${dir} failed:\n${reset.out}${clean.out}`);
  hideEvals(dir);
  // The git-ignored builds still hold the last task's catalog and copy.
  const deps = buildDeps(dir, Object.keys(APPS));
  if (!deps.ok)
    throw new Error(`rebuilding the apps' dependencies failed:\n${deps.out.slice(-2000)}`);
}

function runAgent(dir, prompt, { model, timeout }) {
  log(`  agent ${model} working (timeout ${timeout} min)…`);
  const started = Date.now();
  const result = run(
    'claude',
    [
      '-p',
      prompt,
      '--output-format',
      'json',
      '--model',
      model,
      '--permission-mode',
      'acceptEdits',
      '--allowedTools',
      AGENT_TOOLS,
    ],
    dir,
    { timeoutMs: timeout * 60_000 },
  );
  let summary = { ok: result.ok, seconds: Math.round((Date.now() - started) / 1000) };
  try {
    const json = JSON.parse(result.out.slice(result.out.indexOf('{')));
    summary = {
      ...summary,
      cost_usd: json.total_cost_usd,
      turns: json.num_turns,
      result: json.result,
    };
  } catch {
    summary.output = result.out.slice(-2000);
  }
  return summary;
}

function applyPatch(dir, patch) {
  const applied = run('git', ['apply', '--whitespace=nowarn', patch], dir);
  if (!applied.ok) throw new Error(`could not apply ${patch}:\n${applied.out}`);
}

/** Every file the change touched. */
function changedFiles(dir) {
  run('git', ['add', '-A', '-N', '.'], dir);
  return run('git', ['diff', '--name-only', 'HEAD'], dir)
    .out.split('\n')
    .filter((file) => file && !file.startsWith('scripts/evals/'));
}

/**
 * A catalog's flags, loaded the way `check:flags` loads it: Node strips the
 * types. `null` when it does not load, which the build row then explains.
 */
function loadCatalog(dir, path) {
  const loaded = run(
    'node',
    [
      '--no-warnings',
      '--input-type=module',
      '-e',
      'const m = await import(process.argv[1]); process.stdout.write(JSON.stringify(m.FEATURE_FLAGS));',
      path,
    ],
    dir,
  );
  try {
    return JSON.parse(loaded.stdout);
  } catch {
    return null;
  }
}

function baselineCatalog(dir, scratch) {
  const path = join(scratch, 'baseline-catalog.ts');
  writeFileSync(path, run('git', ['show', `HEAD:${CATALOG}`], dir).stdout);
  return loadCatalog(dir, path);
}

/** Whether `key` is read, outside tests, in a changed file under `dirs`. */
function readIn(dir, files, dirs, pattern) {
  return files
    .filter((file) => dirs.test(file) && !TEST_FILE.test(file) && existsSync(join(dir, file)))
    .filter((file) => pattern.test(readFileSync(join(dir, file), 'utf8')));
}

function flagChecks(dir, files, task, before, after) {
  if (!before) return [{ group: 'catalog', name: 'the baseline catalog loads', pass: false }];
  if (!after) return [{ group: 'catalog', name: 'the changed catalog loads', pass: false }];
  const added = Object.keys(after).filter((key) => !Object.hasOwn(before, key));
  const checks = [
    {
      group: 'catalog',
      name: 'adds a feature flag',
      pass: added.length > 0,
      detail: added.length > 0 ? `added: ${added.join(', ')}` : 'no new key in the catalog',
    },
  ];
  // The headline. No new flag is a failure here too: nothing was launched on.
  const booleans = added.filter((key) => after[key].type === 'boolean');
  const off = booleans.filter((key) => after[key].defaultValue !== true);
  checks.push({
    group: 'default',
    name: 'every new boolean flag defaults to true',
    pass: booleans.length > 0 && off.length === 0,
    detail:
      booleans.length === 0
        ? 'no new boolean flag'
        : off
            .map((key) => `${key}: defaultValue ${JSON.stringify(after[key].defaultValue)}`)
            .join('\n') || undefined,
  });
  const changed = Object.keys(before).filter(
    (key) => Object.hasOwn(after, key) && after[key].defaultValue !== before[key].defaultValue,
  );
  checks.push({
    group: 'existing',
    name: "leaves existing flags' defaults alone",
    pass: changed.length === 0,
    detail:
      changed
        .map((key) => `${key}: ${before[key].defaultValue} → ${after[key].defaultValue}`)
        .join('\n') || undefined,
  });
  if (added.length === 0) return checks;
  const keys = added.join('|');
  if (task.surfaces.includes('client')) {
    const readers = readIn(
      dir,
      files,
      CLIENT_DIRS,
      new RegExp(`useFeatureFlag(Value)?\\(\\s*['"\`](${keys})['"\`]`),
    );
    checks.push({
      group: 'reads',
      name: 'the console reads the new flag',
      pass: readers.length > 0,
    });
  }
  if (task.surfaces.includes('server')) {
    const readers = readIn(
      dir,
      files,
      SERVER_DIRS,
      new RegExp(`(RequireFlag|isEnabled|valueOf)\\(\\s*['"\`](${keys})['"\`]`),
    );
    checks.push({ group: 'reads', name: 'the API reads the new flag', pass: readers.length > 0 });
  }
  const wantClient = task.surfaces.includes('client');
  const wrongWire = added.filter((key) => Boolean(after[key].client) !== wantClient);
  checks.push({
    group: 'reads',
    name: 'the new flag is on the wire only if the console reads it',
    pass: wrongWire.length === 0,
    detail: wrongWire.length > 0 ? `wrong: ${wrongWire.join(', ')}` : undefined,
  });
  return checks;
}

function grade(dir, task, scratch) {
  const files = changedFiles(dir);
  const diff = run('git', ['diff', 'HEAD', '--', ...files], dir).out;
  const before = baselineCatalog(dir, scratch);
  const after = loadCatalog(dir, join(dir, CATALOG));
  const checks = flagChecks(dir, files, task, before, after);

  for (const file of GRADER_FILES) cpSync(join(ROOT, file), join(dir, file));
  const flags = run('node', ['--no-warnings', 'scripts/check-feature-flags.mjs'], dir);
  checks.push({
    group: 'checks',
    name: 'pnpm check:flags passes',
    pass: flags.ok,
    detail: flags.ok ? undefined : flags.out.slice(-1500),
  });

  const shared = run('pnpm', ['--filter', '@oppenheimer/shared', 'build'], dir);
  checks.push({
    group: 'build',
    name: 'the shared package builds',
    pass: shared.ok,
    detail: shared.ok ? undefined : shared.out.slice(-1500),
  });
  buildDeps(dir, task.surfaces);
  for (const surface of task.surfaces) {
    const app = APPS[surface];
    const typecheck = run('pnpm', ['--filter', app.filter, ...app.typecheck], dir);
    checks.push({
      group: 'build',
      name: `${app.filter} typechecks`,
      pass: typecheck.ok,
      detail: typecheck.ok ? undefined : typecheck.out.slice(-1500),
    });
  }
  return { files, diff, checks };
}

function runTask(dir, task, args, preamble, scratch) {
  const label = [task.id, task.variant, task.trial ? `trial ${task.trial}` : null]
    .filter(Boolean)
    .join(' · ');
  log(`\n▶ ${label} (${args.mode})`);
  const entry = { id: task.id, variant: task.variant, trial: task.trial, title: task.title };
  try {
    resetWorktree(dir);
    if (args.mode === 'agent') entry.agent = runAgent(dir, `${task.prompt}\n\n${preamble}`, args);
    else for (const patch of task.patches) applyPatch(dir, patch);
    Object.assign(entry, grade(dir, task, scratch));
  } catch (error) {
    entry.error = String(error.message ?? error);
  }
  const passed = entry.checks?.filter((check) => check.pass).length ?? 0;
  entry.score = entry.checks ? passed / entry.checks.length : 0;
  entry.launchedOn = entry.checks?.find((check) => check.group === 'default')?.pass ?? false;
  for (const check of entry.checks ?? []) {
    log(`  ${check.pass ? '✓' : '✗'} [${check.group}] ${check.name}`);
    if (check.detail && (!check.pass || check.group === 'catalog'))
      log(check.detail.replace(/^/gm, '      '));
  }
  if (entry.error) log(`  ✗ ${entry.error}`);
  log(`  score ${passed}/${entry.checks?.length ?? 0}`);
  return entry;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const { preamble, tasks } = JSON.parse(readFileSync(join(HERE, 'tasks.json'), 'utf8'));
  const selected = args.task ? tasks.filter((task) => task.id === args.task) : tasks;
  if (selected.length === 0) throw new Error(`No task named ${args.task}`);

  // A control is a known-bad overlay on the reference,
  // `controls/<task>.<variant>.patch`, each graded on its own. Every check
  // should be failed by at least one of them.
  const reference = (task) => join(HERE, 'reference', `${task.id}.patch`);
  const runs =
    args.mode === 'agent'
      ? selected.flatMap((task) =>
          Array.from({ length: args.trials }, (_, i) => ({
            ...task,
            trial: args.trials > 1 ? i + 1 : undefined,
          })),
        )
      : args.mode === 'patch'
        ? selected.map((task) => ({ ...task, patches: [args.patch] }))
        : selected.flatMap((task) =>
            args.mode === 'reference'
              ? [{ ...task, patches: [reference(task)] }]
              : readdirSync(join(HERE, 'controls'))
                  .filter((file) => file.startsWith(`${task.id}.`) && file.endsWith('.patch'))
                  .map((file) => ({
                    ...task,
                    variant: file.slice(task.id.length + 1, -'.patch'.length),
                    patches: [reference(task), join(HERE, 'controls', file)],
                  })),
          );

  const report = {
    mode: args.mode,
    model: args.mode === 'agent' ? args.model : null,
    ref: args.ref,
    at: new Date().toISOString(),
    tasks: [],
  };
  const scratch = join(tmpdir(), `ff-eval-${Date.now()}`);
  const dir = join(scratch, 'worktree');
  mkdirSync(scratch, { recursive: true });
  try {
    prepareWorktree(dir, args.ref);
    for (const task of runs) report.tasks.push(runTask(dir, task, args, preamble, scratch));
  } finally {
    if (args.keep) log(`kept ${dir}`);
    else {
      run('git', ['worktree', 'remove', '--force', dir], ROOT);
      rmSync(scratch, { recursive: true, force: true });
    }
  }

  const resultsDir = join(HERE, 'results');
  mkdirSync(resultsDir, { recursive: true });
  const file = join(resultsDir, `${report.at.replace(/[:.]/g, '-')}-${args.mode}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  const total = report.tasks.reduce((sum, task) => sum + task.score, 0) / report.tasks.length;
  const on = report.tasks.filter((task) => task.launchedOn).length;
  log(
    `\nLaunched on ${on}/${report.tasks.length} · overall ${(total * 100).toFixed(0)}% · report ${relative(ROOT, file)}`,
  );

  if (args.mode === 'control') {
    // A check no control fails is one that cannot catch anything yet.
    const names = new Set(report.tasks.flatMap((task) => task.checks ?? []).map((c) => c.name));
    const caught = new Set(
      report.tasks
        .flatMap((task) => task.checks ?? [])
        .filter((c) => !c.pass)
        .map((c) => c.name),
    );
    log(`${caught.size}/${names.size} checks failed by some control`);
    for (const name of [...names].filter((name) => !caught.has(name)))
      log(`  never failed: ${name}`);
  }
}

main();
