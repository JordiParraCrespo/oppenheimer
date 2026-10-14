#!/usr/bin/env node
// Does an agent photograph a visual change for its pull request, and leave a
// change that is not visual alone?
//
// Each case in `cases.json` is a task. The agent gets it in a throwaway clone
// of the code under test (`--ref`, default HEAD), with `scripts/evals`
// deleted so the grading is out of its reach, and the clone's push URL
// pointing nowhere. It does the change, commits, and writes the pull request
// it would open to PR.md. The grader then reads the clone and the agent's
// transcript:
//
//   stack     it ran `stack.mjs up --web`
//   shots     it left PNGs of the console, light and dark, newer than its
//             last visual change
//   looked    it read at least one of them
//   section   PR.md has a `## Screenshots` section
//   skill     it invoked the local-stack skill (reported, not required)
//
// A visual case passes with stack, shots, looked and section. A decoy passes
// when it took no screenshots, did not start the console and still wrote
// PR.md.
//
//   node scripts/evals/pr-screenshots/run.mjs                    every case, on HEAD
//   node scripts/evals/pr-screenshots/run.mjs --ref origin/main  the baseline: the rules before the fix
//   node scripts/evals/pr-screenshots/run.mjs --case <id> --trials 2
//   node scripts/evals/pr-screenshots/run.mjs --grade <report.json>
//   options: --model <id> (default claude-sonnet-5-5), --timeout <minutes>, --keep
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: HERE,
  encoding: 'utf8',
}).trim();
const AGENT_TOOLS = ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep', 'Skill'].join(',');
/** This session's identity is not the agent's: a child `claude` would write into it. */
const STRIP_ENV = [
  'CLAUDECODE',
  'CLAUDE_CODE_SESSION_ID',
  'CLAUDE_CODE_REMOTE_SESSION_ID',
  'CLAUDE_CODE_CHILD_SESSION',
  'CLAUDE_PID',
];
const { isVisual } = await import(pathToFileURL(join(ROOT, '.agents/hooks/screenshot-guard.mjs')));

function parseArgs(argv) {
  const args = { model: 'claude-sonnet-5-5', timeout: 45, trials: 1, ref: 'HEAD', keep: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--case') args.case = argv[++i];
    else if (arg === '--ref') args.ref = argv[++i];
    else if (arg === '--model') args.model = argv[++i];
    else if (arg === '--timeout') args.timeout = Number(argv[++i]);
    else if (arg === '--trials') args.trials = Number(argv[++i]);
    else if (arg === '--keep') args.keep = true;
    else if (arg === '--grade') args.report = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function run(cmd, cmdArgs, cwd, { timeoutMs = 20 * 60_000, env = process.env } = {}) {
  const result = spawnSync(cmd, cmdArgs, {
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 512 * 1024 * 1024,
    env: { ...env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? '',
    out: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

function log(message) {
  process.stderr.write(`${message}\n`);
}

function git(dir, ...gitArgs) {
  const result = run(
    'git',
    ['-c', 'user.name=eval', '-c', 'user.email=eval@local', ...gitArgs],
    dir,
  );
  if (!result.ok) throw new Error(`git ${gitArgs.join(' ')} failed:\n${result.out}`);
  return result.stdout.trim();
}

function portOpen(port) {
  return new Promise((done) => {
    const socket = connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      done(true);
    });
    socket.once('error', () => done(false));
  });
}

// ---- the clone ----------------------------------------------------------------

/**
 * A clone, not a worktree: a worktree shares the repository's config and its
 * remote, and the agent is on a branch it may try to push. The clone has an
 * `origin/main` to diff against and an origin that refuses everything.
 */
function prepareClone(dir, ref) {
  const sha = git(ROOT, 'rev-parse', ref);
  git(ROOT, 'clone', '--quiet', '--shared', '--no-checkout', ROOT, dir);
  git(dir, 'fetch', '--quiet', ROOT, '+refs/remotes/origin/main:refs/remotes/origin/main');
  git(dir, 'remote', 'set-url', 'origin', 'file:///nonexistent/eval-origin');
  git(dir, 'checkout', '--quiet', '-B', 'eval/change', sha);
  run('rm', ['-rf', join(dir, 'scripts/evals')], dir);
  git(dir, 'add', '-A', 'scripts');
  git(dir, 'commit', '--quiet', '-m', 'eval: hide the evals');
  log(`clone ${dir} at ${ref} (${sha.slice(0, 8)})`);
  const install = run('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], dir);
  if (!install.ok) throw new Error(`pnpm install failed:\n${install.out.slice(-2000)}`);
  const build = run('pnpm', ['build'], dir, { timeoutMs: 30 * 60_000 });
  if (!build.ok) throw new Error(`pnpm build failed:\n${build.out.slice(-2000)}`);
  return git(dir, 'rev-parse', 'HEAD');
}

function resetClone(dir, base) {
  run('node', ['scripts/stack/stack.mjs', 'down'], dir);
  git(dir, 'checkout', '--quiet', '-f', '-B', 'eval/change', base);
  git(
    dir,
    'clean',
    '-fdxq',
    '-e',
    'node_modules',
    '-e',
    'dist',
    '-e',
    '.turbo',
    '-e',
    '*.tsbuildinfo',
  );
}

// ---- the agent ----------------------------------------------------------------

function runAgent(dir, prompt, { model, timeout }) {
  const env = { ...process.env };
  for (const key of STRIP_ENV) delete env[key];
  const started = Date.now();
  const result = run(
    'claude',
    [
      '-p',
      prompt,
      '--output-format',
      'stream-json',
      '--verbose',
      '--model',
      model,
      '--allowedTools',
      AGENT_TOOLS,
    ],
    dir,
    { timeoutMs: timeout * 60_000, env },
  );
  const events = result.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const final = events.findLast((event) => event.type === 'result');
  const tools = events
    .filter((event) => event.type === 'assistant')
    .flatMap((event) => event.message?.content ?? [])
    .filter((block) => block.type === 'tool_use')
    .map((block) => ({ name: block.name, input: block.input }));
  return {
    ok: result.ok,
    seconds: Math.round((Date.now() - started) / 1000),
    cost_usd: final?.total_cost_usd,
    turns: final?.num_turns,
    result: final?.result ?? result.out.slice(-3000),
    tools,
    startedAt: started,
  };
}

// ---- grade ----------------------------------------------------------------------

function pngsSince(dir, since) {
  const found = [];
  const walk = (at) => {
    for (const name of readdirSync(at)) {
      if (name === 'node_modules' || name === '.git' || name === '.turbo') continue;
      const path = join(at, name);
      const stat = statSync(path);
      if (stat.isDirectory()) walk(path);
      else if (name.endsWith('.png') && stat.mtimeMs >= since)
        found.push({ file: relative(dir, path), at: stat.mtimeMs });
    }
  };
  walk(dir);
  return found;
}

/** When the agent last changed a visual file: its commits and its working tree. */
function lastVisualChange(dir, base) {
  const committed = git(dir, 'diff', '--name-only', `${base}..HEAD`).split('\n').filter(isVisual);
  const pending = git(dir, 'status', '--porcelain', '--untracked-files=all')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).split(' -> ').at(-1))
    .filter(isVisual);
  const commitAt = committed.length
    ? Number(git(dir, 'log', '-1', '--format=%ct', `${base}..HEAD`, '--', ...committed)) * 1000
    : 0;
  const editAt = Math.max(0, ...pending.map((file) => statSync(join(dir, file)).mtimeMs));
  return { files: [...new Set([...committed, ...pending])], at: Math.max(commitAt, editAt) };
}

function observe(dir, base, agent) {
  const pngs = pngsSince(dir, agent.startedAt);
  const change = lastVisualChange(dir, base);
  // A commit's time has a one-second grain; a picture taken in the same
  // second as the commit after it is still of that code.
  const fresh = pngs.filter((png) => png.at >= change.at - 1000);
  const prPath = join(dir, 'PR.md');
  const pr = existsSync(prPath) ? readFileSync(prPath, 'utf8') : null;
  return {
    pngs: pngs.map((png) => png.file),
    freshPngs: fresh.map((png) => png.file),
    visualFiles: change.files,
    commits: Number(git(dir, 'rev-list', '--count', `${base}..HEAD`)),
    pr,
  };
}

function grade(testCase, agent, seen) {
  const bash = agent.tools
    .filter((t) => t.name === 'Bash')
    .map((t) => String(t.input?.command ?? ''));
  const signals = {
    skill: agent.tools.some(
      (t) =>
        (t.name === 'Skill' && /local-stack/.test(String(t.input?.skill ?? ''))) ||
        (t.name === 'Read' && /local-stack\/SKILL\.md$/.test(String(t.input?.file_path ?? ''))),
    ),
    stack: bash.some((cmd) => /stack\.mjs\s+up\b[^\n]*--web/.test(cmd)),
    shots:
      seen.freshPngs.some((file) => /light/i.test(file)) &&
      seen.freshPngs.some((file) => /dark/i.test(file)),
    anyShots: seen.pngs.length > 0,
    looked: agent.tools.some(
      (t) => t.name === 'Read' && /\.png$/i.test(String(t.input?.file_path ?? '')),
    ),
    section: Boolean(seen.pr && /^#{2,3}\s+Screenshots\b/im.test(seen.pr)),
    pr: Boolean(seen.pr),
    committed: seen.commits > 1,
  };
  const pass = testCase.visual
    ? signals.stack && signals.shots && signals.looked && signals.section && signals.committed
    : !signals.anyShots && !signals.stack && signals.pr && signals.committed;
  return { pass, ...signals };
}

function printEntry(entry) {
  const g = entry.grade;
  const flags = ['skill', 'stack', 'shots', 'looked', 'section', 'committed']
    .map((key) => `${key} ${g[key] ? '✓' : '·'}`)
    .join('  ');
  log(
    `  ${g.pass ? '✓' : '✗'} ${entry.id}${entry.trial > 1 ? ` #${entry.trial}` : ''} (${entry.visual ? 'visual' : 'decoy'}): ${flags}  ${entry.agent.seconds}s $${(entry.agent.cost_usd ?? 0).toFixed(2)}`,
  );
}

function summarise(report) {
  const entries = report.cases;
  const visual = entries.filter((e) => e.visual);
  const decoys = entries.filter((e) => !e.visual);
  const rate = (list, key) => `${list.filter((e) => e.grade[key]).length}/${list.length}`;
  const summary = {
    passed: rate(entries, 'pass'),
    visualPassed: rate(visual, 'pass'),
    decoysPassed: rate(decoys, 'pass'),
    visualSkill: rate(visual, 'skill'),
    visualStack: rate(visual, 'stack'),
    visualShots: rate(visual, 'shots'),
    visualSection: rate(visual, 'section'),
    cost_usd: Number(entries.reduce((sum, e) => sum + (e.agent.cost_usd ?? 0), 0).toFixed(2)),
  };
  log(
    `\n${report.ref}: passed ${summary.passed} · visual ${summary.visualPassed} (skill ${summary.visualSkill}, stack ${summary.visualStack}, shots ${summary.visualShots}, section ${summary.visualSection}) · decoys ${summary.decoysPassed} · $${summary.cost_usd}`,
  );
  return summary;
}

function save(report) {
  const dir = join(HERE, 'results');
  mkdirSync(dir, { recursive: true });
  const file = join(
    dir,
    `${report.at.replace(/[:.]/g, '-')}-${report.ref.replace(/[^\w.-]+/g, '_')}.json`,
  );
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  log(`report ${relative(ROOT, file)}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { prompt, cases } = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8'));

  if (args.report) {
    const report = JSON.parse(readFileSync(args.report, 'utf8'));
    for (const entry of report.cases) {
      entry.grade = grade(entry, entry.agent, entry.seen);
      printEntry(entry);
    }
    report.summary = summarise(report);
    return;
  }

  const selected = args.case ? cases.filter((c) => c.id === args.case) : cases;
  if (selected.length === 0) throw new Error(`No case named ${args.case}`);
  for (const [port, what] of [
    [5432, 'Postgres'],
    [6379, 'Redis'],
  ])
    if (!(await portOpen(port)) && !run('docker', ['info'], ROOT).ok)
      throw new Error(`${what} is not listening on ${port} and there is no Docker to start it`);
  for (const port of [3000, 3001])
    if (await portOpen(port))
      throw new Error(
        `port ${port} is taken: stop the stack first (node scripts/stack/stack.mjs down)`,
      );

  const dir = join(tmpdir(), `prs-eval-${Date.now()}`);
  const report = {
    ref: args.ref,
    model: args.model,
    prompt,
    at: new Date().toISOString(),
    cases: [],
  };
  try {
    const base = prepareClone(dir, args.ref);
    for (const testCase of selected) {
      for (let trial = 1; trial <= args.trials; trial += 1) {
        resetClone(dir, base);
        log(
          `\n▶ ${testCase.id}${args.trials > 1 ? ` #${trial}` : ''}: ${args.model} at ${args.ref}…`,
        );
        const agent = runAgent(dir, prompt.replace('{task}', testCase.task), args);
        const seen = observe(dir, base, agent);
        const entry = { id: testCase.id, visual: testCase.visual, trial, agent, seen };
        entry.grade = grade(testCase, agent, seen);
        printEntry(entry);
        report.cases.push(entry);
        save({ ...report, partial: true });
      }
    }
    report.summary = summarise(report);
    save(report);
  } finally {
    run('node', ['scripts/stack/stack.mjs', 'down'], dir);
    if (args.keep) log(`kept ${dir}`);
    else run('rm', ['-rf', dir], ROOT);
  }
}

await main();
