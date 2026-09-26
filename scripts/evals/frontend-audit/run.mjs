#!/usr/bin/env node
// Does the frontend-audit prompt find what it should, and only that?
//
// Each case in `cases.json` is a small change to `apps/web` (the files under
// `cases/<id>/`, laid over the repo at their own paths) committed on top of
// HEAD in a throwaway worktree, the way a day's merge lands before the routine
// runs. Nine cases plant one rule break each; three are decoys that look like
// one and are not. `scripts/evals` is deleted from the worktree first, so the
// expectations are out of the auditor's reach.
//
// The auditor runs the skill exactly as the routine does, in diff mode against
// the commit before the case, and must end with the skill's JSON block. The
// grader then scores:
//   recall   each expected finding: its rule (or an accepted alternative) on
//            its file
//   noise    a `medium` or `high` finding on a case file that no expectation
//            names, for a rule not in `tolerate`
// A case passes when every expectation is met and there is no noise.
//
//   node scripts/evals/frontend-audit/run.mjs                         every case, the agent
//   node scripts/evals/frontend-audit/run.mjs --case <id>             one case
//   node scripts/evals/frontend-audit/run.mjs --trials 3              each case three times
//   node scripts/evals/frontend-audit/run.mjs --validate              the fixtures: typecheck, and the
//                                                                     mechanical checks fail only where
//                                                                     a case says they should
//   node scripts/evals/frontend-audit/run.mjs --grade <report.json>   re-grade a saved report
//   options: --model <id> (default claude-sonnet-5), --timeout <minutes>, --keep
import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
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
const AGENT_TOOLS = [
  'Read',
  'Glob',
  'Grep',
  'Skill',
  'Bash(pnpm:*)',
  'Bash(node:*)',
  'Bash(npx:*)',
  'Bash(git diff:*)',
  'Bash(git log:*)',
  'Bash(git show:*)',
  'Bash(git status:*)',
  'Bash(git rev-parse:*)',
  'Bash(git merge-base:*)',
  'Bash(ls:*)',
  'Bash(cat:*)',
  'Bash(grep:*)',
  'Bash(sed -n:*)',
  'Bash(wc:*)',
].join(',');
const SERIOUS = new Set(['high', 'medium']);

function parseArgs(argv) {
  const args = { model: 'claude-sonnet-5', timeout: 30, trials: 1, mode: 'agent', keep: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--case') args.case = argv[++i];
    else if (arg === '--model') args.model = argv[++i];
    else if (arg === '--timeout') args.timeout = Number(argv[++i]);
    else if (arg === '--trials') args.trials = Number(argv[++i]);
    else if (arg === '--keep') args.keep = true;
    else if (arg === '--validate') args.mode = 'validate';
    else if (arg === '--grade') {
      args.mode = 'grade';
      args.report = resolve(argv[++i]);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
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

// One worktree for the run, installed and built once. The frontend packages
// are built so `pnpm arch` and the typecheck resolve the workspace imports.
function prepareWorktree(dir) {
  git(ROOT, 'worktree', 'add', '--detach', dir, 'HEAD');
  log(`worktree ${dir}`);
  rmSync(join(dir, 'scripts/evals'), { recursive: true, force: true });
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'eval: hide the evals');
  const install = run('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], dir);
  if (!install.ok) throw new Error(`pnpm install failed:\n${install.out.slice(-2000)}`);
  const deps = run('pnpm', ['turbo', 'run', 'build', '--filter=@oppenheimer/web^...'], dir);
  if (!deps.ok)
    throw new Error(`building the web app's dependencies failed:\n${deps.out.slice(-2000)}`);
  return git(dir, 'rev-parse', 'HEAD');
}

function resetWorktree(dir, base) {
  git(dir, 'reset', '--hard', '-q', base);
  git(dir, 'clean', '-fdq', '-e', 'node_modules', '-e', 'dist', '-e', '.turbo');
}

function caseFiles(id) {
  const top = join(HERE, 'cases', id);
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else files.push(relative(top, path));
    }
  };
  walk(top);
  return files;
}

/** Lays the case over the worktree and commits it, as the day's change. */
function applyCase(dir, testCase) {
  cpSync(join(HERE, 'cases', testCase.id), dir, { recursive: true });
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', testCase.commit);
}

// ---- validate: the fixtures test the prompt, not the scripts ----------------

function mechanicalFailures(dir, files) {
  const failed = [];
  const tsc = run('pnpm', ['--filter', '@oppenheimer/web', 'exec', 'tsc', '-b'], dir);
  if (!tsc.ok) failed.push({ id: 'typecheck', detail: tsc.out.slice(-1500) });
  const structure = run('node', ['scripts/check-frontend-structure.mjs'], dir);
  if (!structure.ok) failed.push({ id: 'M-structure', detail: structure.out.slice(-1500) });
  const arch = run('pnpm', ['--filter', '@oppenheimer/web', 'arch'], dir);
  if (!arch.ok) failed.push({ id: 'M-arch', detail: arch.out.slice(-1500) });
  const biome = run('pnpm', ['exec', 'biome', 'lint', '--error-on-warnings', ...files], dir);
  if (!biome.ok) failed.push({ id: 'M-biome', detail: biome.out.slice(-1500) });
  const design = run(
    'pnpm',
    [
      'exec',
      'oxlint',
      '-c',
      'packages/frontend/design-system/web/oxlint.design.json',
      '--deny-warnings',
      ...files,
    ],
    dir,
  );
  if (!design.ok) failed.push({ id: 'M-design', detail: design.out.slice(-1500) });
  const compiler = run('node', ['scripts/check-react-compiler.mjs', '--json'], dir);
  const bailouts = JSON.parse(compiler.stdout).bailouts.filter((b) => files.includes(b.file));
  if (bailouts.length > 0)
    failed.push({
      id: 'M-compiler',
      detail: bailouts.map((b) => `${b.file}:${b.line} ${b.reason}`).join('\n'),
    });
  return failed;
}

function validateCase(dir, base, testCase) {
  resetWorktree(dir, base);
  applyCase(dir, testCase);
  const files = caseFiles(testCase.id);
  const failed = mechanicalFailures(dir, files);
  const want = new Set(testCase.mechanical ?? []);
  const got = new Set(failed.map((f) => f.id));
  const problems = [
    ...failed.filter((f) => !want.has(f.id)).map((f) => `unexpected ${f.id}:\n${f.detail}`),
    ...[...want].filter((id) => !got.has(id)).map((id) => `expected ${id} to fail, it passed`),
  ];
  log(
    `${problems.length === 0 ? '✓' : '✗'} ${testCase.id}${want.size ? ` (fails ${[...want].join(', ')} as intended)` : ''}`,
  );
  for (const problem of problems) log(problem.replace(/^/gm, '    '));
  return { id: testCase.id, ok: problems.length === 0, problems };
}

// ---- agent ------------------------------------------------------------------

function runAgent(dir, prompt, { model, timeout }) {
  const started = Date.now();
  const result = run(
    'claude',
    ['-p', prompt, '--output-format', 'json', '--model', model, '--allowedTools', AGENT_TOOLS],
    dir,
    { timeoutMs: timeout * 60_000 },
  );
  const summary = { ok: result.ok, seconds: Math.round((Date.now() - started) / 1000) };
  try {
    const json = JSON.parse(result.out.slice(result.out.indexOf('{')));
    return {
      ...summary,
      cost_usd: json.total_cost_usd,
      turns: json.num_turns,
      result: json.result,
    };
  } catch {
    return { ...summary, output: result.out.slice(-3000) };
  }
}

/** The skill's JSON block: the last fenced `json` block, or the whole answer. */
function parseAudit(text) {
  if (!text) return null;
  const blocks = [...text.matchAll(/```json\s*\n([\s\S]*?)```/g)];
  for (const candidate of [blocks.at(-1)?.[1], text]) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate.trim());
      if (Array.isArray(parsed.findings)) return parsed;
    } catch {}
  }
  return null;
}

function normalise(file, dir) {
  if (!file) return '';
  const path = file.replace(/:\d+(:\d+)?$/, '').replace(/^\.\//, '');
  return dir && path.startsWith(dir) ? relative(dir, path) : path;
}

// ---- grade ------------------------------------------------------------------

function grade(testCase, audit, tolerate, dir) {
  if (!audit)
    return { pass: false, parsed: false, hits: 0, expected: testCase.expect.length, noise: [] };
  const files = new Set(caseFiles(testCase.id));
  const findings = audit.findings.map((f) => ({ ...f, file: normalise(f.file, dir) }));
  const expectations = testCase.expect.map((e) => {
    const rules = new Set([e.rule, ...(e.accept ?? [])]);
    const where = new Set([e.file, ...(e.alsoFile ?? [])]);
    const byCheck = [...rules].some(
      (rule) => rule.startsWith('M-') && audit.checks?.[rule] === 'fail',
    );
    const match = findings.find(
      (f) => rules.has(f.rule) && (where.has(f.file) || f.rule.startsWith('M-')),
    );
    return {
      rule: e.rule,
      file: e.file,
      hit: Boolean(match) || byCheck,
      by: match?.rule ?? (byCheck ? 'checks' : null),
    };
  });
  const named = new Set(
    testCase.expect.flatMap((e) =>
      [e.rule, ...(e.accept ?? [])].flatMap((rule) =>
        [e.file, ...(e.alsoFile ?? [])].map((file) => `${rule}:${file}`),
      ),
    ),
  );
  const noise = findings.filter(
    (f) =>
      files.has(f.file) &&
      SERIOUS.has(f.severity) &&
      !tolerate.includes(f.rule) &&
      !named.has(`${f.rule}:${f.file}`),
  );
  const hits = expectations.filter((e) => e.hit).length;
  return {
    pass: hits === expectations.length && noise.length === 0,
    parsed: true,
    hits,
    expected: expectations.length,
    expectations,
    noise: noise.map((f) => ({
      rule: f.rule,
      file: f.file,
      severity: f.severity,
      summary: f.summary,
    })),
    outside: findings.filter((f) => !files.has(f.file)).length,
  };
}

function printEntry(entry) {
  const g = entry.grade;
  log(
    `  ${g.pass ? '✓' : '✗'} ${entry.id}${entry.trial > 1 ? ` #${entry.trial}` : ''}: ${g.parsed ? `${g.hits}/${g.expected} expected, ${g.noise.length} noise, ${g.outside} outside the change` : 'no JSON block in the answer'}`,
  );
  for (const e of g.expectations ?? []) if (!e.hit) log(`      missed ${e.rule} on ${e.file}`);
  for (const n of g.noise)
    log(`      noise ${n.rule} ${n.severity} on ${n.file}: ${n.summary ?? ''}`);
}

function summarise(report) {
  const entries = report.cases;
  const expected = entries.reduce((sum, e) => sum + e.grade.expected, 0);
  const hits = entries.reduce((sum, e) => sum + e.grade.hits, 0);
  const clean = entries.filter((e) => e.grade.expected === 0);
  const summary = {
    passed: `${entries.filter((e) => e.grade.pass).length}/${entries.length}`,
    recall: expected ? Number((hits / expected).toFixed(2)) : null,
    noise: entries.reduce((sum, e) => sum + e.grade.noise.length, 0),
    decoysClean: `${clean.filter((e) => e.grade.pass).length}/${clean.length}`,
    unparsed: entries.filter((e) => !e.grade.parsed).length,
    cost_usd: Number(entries.reduce((sum, e) => sum + (e.agent?.cost_usd ?? 0), 0).toFixed(2)),
  };
  log(
    `\npassed ${summary.passed} · recall ${summary.recall} · noise ${summary.noise} · decoys clean ${summary.decoysClean} · unparsed ${summary.unparsed} · $${summary.cost_usd}`,
  );
  return summary;
}

function save(report) {
  const dir = join(HERE, 'results');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${report.at.replace(/[:.]/g, '-')}-${report.mode}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  log(`report ${relative(ROOT, file)}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const { prompt, tolerate, cases } = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8'));
  const selected = args.case ? cases.filter((c) => c.id === args.case) : cases;
  if (selected.length === 0) throw new Error(`No case named ${args.case}`);

  if (args.mode === 'grade') {
    const report = JSON.parse(readFileSync(args.report, 'utf8'));
    for (const entry of report.cases) {
      const testCase = cases.find((c) => c.id === entry.id);
      entry.grade = grade(testCase, parseAudit(entry.agent?.result), tolerate, entry.worktree);
      printEntry(entry);
    }
    report.summary = summarise(report);
    report.mode = 'regrade';
    report.at = new Date().toISOString();
    save(report);
    return;
  }

  const dir = join(tmpdir(), `fa-eval-${Date.now()}`);
  const report = {
    mode: args.mode,
    model: args.mode === 'agent' ? args.model : null,
    prompt,
    at: new Date().toISOString(),
    cases: [],
  };
  try {
    const base = prepareWorktree(dir);
    if (args.mode === 'validate') {
      const results = selected.map((testCase) => validateCase(dir, base, testCase));
      const bad = results.filter((r) => !r.ok).length;
      log(`\n${results.length - bad}/${results.length} fixtures valid`);
      process.exitCode = bad ? 1 : 0;
      return;
    }
    for (const testCase of selected) {
      for (let trial = 1; trial <= args.trials; trial += 1) {
        resetWorktree(dir, base);
        applyCase(dir, testCase);
        const casePrompt = prompt.replace('{base}', base);
        log(`\n▶ ${testCase.id}${args.trials > 1 ? ` #${trial}` : ''}: ${args.model} auditing…`);
        const agent = runAgent(dir, casePrompt, args);
        const entry = { id: testCase.id, trial, worktree: dir, agent };
        entry.grade = grade(testCase, parseAudit(agent.result), tolerate, dir);
        printEntry(entry);
        report.cases.push(entry);
      }
    }
    report.summary = summarise(report);
    save(report);
  } finally {
    if (args.keep) log(`kept ${dir}`);
    else run('git', ['worktree', 'remove', '--force', dir], ROOT);
  }
}

main();
