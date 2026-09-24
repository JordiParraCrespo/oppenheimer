#!/usr/bin/env node
// Does an agent follow the query-key conventions when nobody tells it to?
//
// Each task is a realistic ticket for @oppenheimer/frontend-consumer that needs
// a query or a mutation hook. The ticket names the public API (hook, service
// method, DI token) the way a real one would, and says nothing about keys. The
// agent works in a throwaway git worktree with the repo's own CLAUDE.md and
// guides; `scripts/evals` is deleted from that worktree first, so the hidden
// specs and reference patches below are out of its reach.
//
// Afterwards the grader runs, in the worktree:
//   lint    the Biome plugins the task names, over the files the agent changed,
//           with the repo's own biome.json and plugins put back first
//   build   `pnpm --filter @oppenheimer/frontend-consumer build` (tsc)
//   tests   the package's existing tests
//   hidden  hidden/<task>.spec.tsx, copied in only now: one `it` per guideline,
//           asked of a real QueryClient
//
//   node scripts/evals/query-keys/run.mjs                      every task, the agent
//   node scripts/evals/query-keys/run.mjs --task host-rename   one task
//   node scripts/evals/query-keys/run.mjs --reference          the reference patches (must score 100%)
//   node scripts/evals/query-keys/run.mjs --control            the known-bad overlays on the reference (must fail)
//   node scripts/evals/query-keys/run.mjs --task <id> --patch <file>   grade a saved diff, e.g. from a report
//   options: --model <id> (default claude-sonnet-5), --keep (leave the worktree), --timeout <minutes>
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
const CONSUMER = 'packages/frontend/consumer';
// The grader's own inputs: restored from HEAD before linting, so an agent that
// edits them changes its diff, not its score.
const GRADER_FILES = ['biome.json', 'biome-plugins'];
// Each plugin's diagnostic, read from the plugin itself: Biome reports every
// plugin finding as category `plugin`, without its name.
const PLUGINS = Object.fromEntries(
  readdirSync(join(ROOT, 'biome-plugins'))
    .filter((file) => file.endsWith('.grit'))
    .map((file) => [
      file.slice(0, -'.grit'.length),
      /message="([^"]+)"/.exec(readFileSync(join(ROOT, 'biome-plugins', file), 'utf8'))?.[1],
    ]),
);
const TESTS_DIR = `${CONSUMER}/src/react/__tests__`;
const AGENT_TOOLS = [
  'Read',
  'Edit',
  'Write',
  'Glob',
  'Grep',
  'Bash(pnpm:*)',
  'Bash(npx:*)',
  'Bash(git status:*)',
  'Bash(git diff:*)',
  'Bash(ls:*)',
  'Bash(cat:*)',
  'Bash(grep:*)',
  'Bash(sed -n:*)',
].join(',');

function parseArgs(argv) {
  const args = { model: 'claude-sonnet-5', timeout: 30, mode: 'agent', keep: false, task: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--task') args.task = argv[++i];
    else if (arg === '--model') args.model = argv[++i];
    else if (arg === '--timeout') args.timeout = Number(argv[++i]);
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

function run(cmd, cmdArgs, cwd, { timeoutMs = 15 * 60_000, input } = {}) {
  const result = spawnSync(cmd, cmdArgs, {
    cwd,
    input,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout,
    out: `${result.stdout}${result.stderr}`,
  };
}

function log(message) {
  process.stderr.write(`${message}\n`);
}

// One worktree for the whole run, installed and built once; `resetWorktree`
// puts it back between tasks and keeps the git-ignored node_modules and dist.
function prepareWorktree(dir) {
  const added = run('git', ['worktree', 'add', '--detach', dir, 'HEAD'], ROOT);
  if (!added.ok) throw new Error(`git worktree add failed:\n${added.out}`);
  log(`worktree ${dir}`);
  hideEvals(dir);
  const install = run('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], dir);
  if (!install.ok) throw new Error(`pnpm install failed:\n${install.out.slice(-2000)}`);
  const deps = run(
    'pnpm',
    ['turbo', 'run', 'build', `--filter=@oppenheimer/frontend-consumer^...`],
    dir,
  );
  if (!deps.ok)
    throw new Error(`building the consumer's dependencies failed:\n${deps.out.slice(-2000)}`);
}

// The agent must not see the hidden specs or the reference answers.
function hideEvals(dir) {
  rmSync(join(dir, 'scripts/evals'), { recursive: true, force: true });
}

function resetWorktree(dir) {
  const reset = run('git', ['reset', '--hard', '-q', 'HEAD'], dir);
  const clean = run('git', ['clean', '-fdq'], dir);
  if (!reset.ok || !clean.ok) throw new Error(`resetting ${dir} failed:\n${reset.out}${clean.out}`);
  hideEvals(dir);
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

/** Every file the change touched, outside the hidden eval directory. */
function changedFiles(dir) {
  run('git', ['add', '-A', '-N', '.'], dir);
  return run('git', ['diff', '--name-only', 'HEAD'], dir)
    .out.split('\n')
    .filter((file) => file && !file.startsWith('scripts/evals/'));
}

// A row for each plugin the task names, and one for any other plugin that
// finds something: a plugin with nothing to look at is not a free point.
function lintChecks(dir, files, plugins) {
  const sources = files.filter((file) => /\.(ts|tsx)$/.test(file) && existsSync(join(dir, file)));
  if (sources.length === 0)
    return [{ group: 'lint', name: 'the change touches TypeScript files', pass: false }];
  run('git', ['checkout', 'HEAD', '--', ...GRADER_FILES], dir);
  const lint = run(
    'pnpm',
    ['exec', 'biome', 'lint', '--reporter=json', '--max-diagnostics=none', ...sources],
    dir,
  );
  let diagnostics;
  try {
    diagnostics = JSON.parse(lint.stdout).diagnostics;
  } catch {
    return [{ group: 'lint', name: 'biome ran', pass: false, detail: lint.out.slice(-1500) }];
  }
  const findings = Map.groupBy(
    diagnostics.filter((diagnostic) => diagnostic.category === 'plugin'),
    (diagnostic) =>
      Object.keys(PLUGINS).find((plugin) => PLUGINS[plugin] === diagnostic.message) ??
      'an unknown plugin',
  );
  return [...new Set([...plugins, ...findings.keys()])].map((plugin) => {
    const hits = findings.get(plugin) ?? [];
    return {
      group: 'lint',
      name: `no ${plugin} findings`,
      pass: hits.length === 0,
      detail:
        hits.map((hit) => `${hit.location?.path ?? '?'}: ${hit.message}`).join('\n') || undefined,
    };
  });
}

function hiddenChecks(dir, taskId) {
  const tests = join(dir, TESTS_DIR);
  cpSync(join(HERE, 'hidden/_harness.tsx'), join(tests, '_eval-harness.tsx'));
  const spec = join(tests, `zz-eval-${taskId}.spec.tsx`);
  cpSync(join(HERE, `hidden/${taskId}.spec.tsx`), spec);
  const report = join(dir, 'eval-hidden.json');
  run(
    'npx',
    [
      'vitest',
      'run',
      relative(join(dir, CONSUMER), spec),
      '--reporter=json',
      `--outputFile=${report}`,
    ],
    join(dir, CONSUMER),
  );
  if (!existsSync(report)) return [{ group: 'hidden', name: 'hidden spec ran', pass: false }];
  const json = JSON.parse(readFileSync(report, 'utf8'));
  const results = json.testResults.flatMap((file) => file.assertionResults);
  if (results.length === 0) {
    const message = json.testResults.map((file) => file.message).join('\n');
    return [
      { group: 'hidden', name: 'hidden spec loaded', pass: false, detail: message.slice(0, 1500) },
    ];
  }
  return results.map((test) => ({
    group: 'hidden',
    name: test.title,
    pass: test.status === 'passed',
    detail:
      test.status === 'passed'
        ? undefined
        : (test.failureMessages ?? []).join('\n').split('\n').slice(0, 4).join('\n'),
  }));
}

function grade(dir, task) {
  const files = changedFiles(dir);
  // The diff as the change left it, before the grader restores its own files.
  const diff = run('git', ['diff', 'HEAD', '--', ...files], dir).out;
  const checks = [...lintChecks(dir, files, task.plugins ?? [])];
  const build = run('pnpm', ['--filter', '@oppenheimer/frontend-consumer', 'build'], dir);
  checks.push({
    group: 'build',
    name: 'consumer builds (tsc)',
    pass: build.ok,
    detail: build.ok ? undefined : build.out.slice(-1500),
  });
  const tests = run('pnpm', ['--filter', '@oppenheimer/frontend-consumer', 'test'], dir);
  checks.push({
    group: 'tests',
    name: 'existing consumer tests pass',
    pass: tests.ok,
    detail: tests.ok ? undefined : tests.out.slice(-1500),
  });
  checks.push(...hiddenChecks(dir, task.id));
  return { files, diff, checks };
}

function runTask(dir, task, args, preamble) {
  log(`\n▶ ${task.id}${task.variant ? ` · ${task.variant}` : ''} (${args.mode})`);
  const entry = { id: task.id, variant: task.variant, title: task.title };
  try {
    resetWorktree(dir);
    if (args.mode === 'agent') entry.agent = runAgent(dir, `${task.prompt}\n\n${preamble}`, args);
    else for (const patch of task.patches) applyPatch(dir, patch);
    Object.assign(entry, grade(dir, task));
  } catch (error) {
    entry.error = String(error.message ?? error);
  }
  const passed = entry.checks?.filter((check) => check.pass).length ?? 0;
  entry.score = entry.checks ? passed / entry.checks.length : 0;
  for (const check of entry.checks ?? []) {
    log(`  ${check.pass ? '✓' : '✗'} [${check.group}] ${check.name}`);
    if (!check.pass && check.detail) log(check.detail.replace(/^/gm, '      '));
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
      ? selected
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
    at: new Date().toISOString(),
    tasks: [],
  };
  const dir = join(tmpdir(), `qk-eval-${Date.now()}`);
  try {
    prepareWorktree(dir);
    for (const task of runs) report.tasks.push(runTask(dir, task, args, preamble));
  } finally {
    if (args.keep) log(`kept ${dir}`);
    else run('git', ['worktree', 'remove', '--force', dir], ROOT);
  }

  const resultsDir = join(HERE, 'results');
  mkdirSync(resultsDir, { recursive: true });
  const file = join(resultsDir, `${report.at.replace(/[:.]/g, '-')}-${args.mode}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  const total = report.tasks.reduce((sum, task) => sum + task.score, 0) / report.tasks.length;
  log(`\nOverall ${(total * 100).toFixed(0)}% · report ${relative(ROOT, file)}`);

  if (args.mode === 'control') {
    // A check no control fails is one that cannot catch anything yet.
    const byTask = Map.groupBy(report.tasks, (task) => task.id);
    for (const [id, variants] of byTask) {
      const names = new Set(variants.flatMap((task) => task.checks ?? []).map((c) => c.name));
      const caught = new Set(
        variants
          .flatMap((task) => task.checks ?? [])
          .filter((c) => !c.pass)
          .map((c) => c.name),
      );
      const unexercised = [...names].filter((name) => !caught.has(name));
      log(`${id}: ${caught.size}/${names.size} checks failed by some control`);
      for (const name of unexercised) log(`  never failed: ${name}`);
    }
  }
}

main();
