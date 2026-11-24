#!/usr/bin/env node
// The autoreview eval: does the reviewer `/autoreview` spawns catch the bugs
// it let through before, and stay quiet about the same code done right?
//
// Each planted case in `cases.json` is a small copy of a bug a bot found after
// autoreview said CLEAN, in the last two hundred pull requests (`from` names
// the pull request). A decoy (`decoyOf`) is the same change done right. The
// case's files under `cases/<id>/` are laid over a throwaway worktree at
// their own paths and committed as the branch; files under `base/<id>/` are
// committed first, as code older than the branch. `scripts/evals` is deleted
// from the worktree, so the expectations are out of the reviewer's reach.
//
//   node scripts/evals/autoreview/run.mjs --validate          the fixtures, no agent
//   node scripts/evals/autoreview/run.mjs [--case <id>]       the reviewer (default claude-sonnet-5-5)
//   node scripts/evals/autoreview/run.mjs --ref origin/main   the same, with the skill and rules of <ref>
//   node scripts/evals/autoreview/run.mjs --grade <report>    re-grade a saved report
//   options: --model <id>, --trials <n>, --timeout <minutes>, --concurrency <n>, --keep
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: HERE,
  encoding: 'utf8',
}).trim();
const REVIEWER_TOOLS = [
  'Read',
  'Glob',
  'Grep',
  'Bash(node:*)',
  'Bash(git diff:*)',
  'Bash(git log:*)',
  'Bash(git show:*)',
  'Bash(git grep:*)',
  'Bash(git rev-parse:*)',
  'Bash(ls:*)',
  'Bash(cat:*)',
  'Bash(grep:*)',
  'Bash(sed -n:*)',
  'Bash(wc:*)',
].join(',');
const SERIOUS = new Set(['P0', 'P1']);

export function parseArgs(argv) {
  const args = {
    model: 'claude-sonnet-5-5',
    timeout: 20,
    trials: 1,
    concurrency: 4,
    mode: 'agent',
    ref: 'HEAD',
    keep: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--case') args.case = argv[++i];
    else if (arg === '--model') args.model = argv[++i];
    else if (arg === '--timeout') args.timeout = Number(argv[++i]);
    else if (arg === '--trials') args.trials = Number(argv[++i]);
    else if (arg === '--concurrency') args.concurrency = Number(argv[++i]);
    else if (arg === '--ref') args.ref = argv[++i];
    else if (arg === '--keep') args.keep = true;
    else if (arg === '--bundles') args.bundles = true;
    else if (arg === '--validate') args.mode = 'validate';
    else if (arg === '--grade') {
      args.mode = 'grade';
      args.report = resolve(argv[++i]);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

const log = (message) => process.stderr.write(`${message}\n`);

function git(dir, ...gitArgs) {
  return execFileSync('git', ['-c', 'user.name=eval', '-c', 'user.email=eval@local', ...gitArgs], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function filesUnder(top) {
  if (!existsSync(top)) return [];
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else files.push(relative(top, path));
    }
  };
  walk(top);
  return files.sort();
}

export const caseFiles = (id) => filesUnder(join(HERE, 'cases', id));
export const baseFiles = (id) => filesUnder(join(HERE, 'base', id));

/**
 * The cases: `cases.json`, plus `cases.web.json`, the cases on the console,
 * kept apart so a project that drops the web app drops them with it.
 */
export function loadCases() {
  const main = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8'));
  const path = join(HERE, 'cases.web.json');
  const web = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  return {
    prompt: main.prompt,
    cases: [...main.cases, ...(web.cases ?? [])],
    bundles: [...(main.bundles ?? []), ...(web.bundles ?? [])],
  };
}

// ---- validate: each fixture is a real test of the brief ---------------------

/** What is wrong with the cases, without an agent or a worktree. */
export function validateCases(cases, { exists = (path) => existsSync(join(ROOT, path)) } = {}) {
  const problems = [];
  const ids = new Set();
  const ts = createRequire(join(ROOT, 'package.json'))('typescript');
  for (const testCase of cases) {
    const where = `case ${testCase.id}`;
    if (ids.has(testCase.id)) problems.push(`${where}: duplicate id`);
    ids.add(testCase.id);
    for (const field of ['task', 'commit']) {
      if (!testCase[field]) problems.push(`${where}: no ${field}`);
    }
    const files = caseFiles(testCase.id);
    const base = baseFiles(testCase.id);
    if (files.length === 0) problems.push(`${where}: no files under cases/${testCase.id}/`);
    // A case adds files the repository does not have, so the diff is the case
    // and nothing it overwrote; a file it changes comes from its own base.
    for (const file of [...files, ...base]) {
      if (exists(file) && !base.includes(file))
        problems.push(`${where}: ${file} already exists in the repository`);
      const dir = files.includes(file) ? 'cases' : 'base';
      const source = readFileSync(join(HERE, dir, testCase.id, file), 'utf8');
      if (/\.(ts|tsx)$/.test(file)) {
        const out = ts.transpileModule(source, {
          fileName: file,
          reportDiagnostics: true,
          compilerOptions: { jsx: ts.JsxEmit.ReactJSX, experimentalDecorators: true },
        });
        for (const d of out.diagnostics ?? []) {
          problems.push(
            `${where}: ${file} does not parse: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`,
          );
        }
      }
    }
    if (testCase.decoyOf) {
      const planted = cases.find((c) => c.id === testCase.decoyOf);
      if (!planted?.expect) problems.push(`${where}: decoyOf names no planted case`);
      if (testCase.expect) problems.push(`${where}: a decoy expects no finding`);
      continue;
    }
    if (!testCase.from) problems.push(`${where}: no "from" (the pull request the bug came from)`);
    if (!testCase.expect?.files?.length) problems.push(`${where}: expects no file`);
    try {
      new RegExp(testCase.expect?.match ?? '', 'i');
    } catch (error) {
      problems.push(`${where}: match is not a regex: ${error.message}`);
    }
    for (const file of testCase.expect?.files ?? []) {
      if (!files.includes(file) && !base.includes(file))
        problems.push(`${where}: expects ${file}, which it does not add`);
    }
    for (const { file, contains } of testCase.validate ?? []) {
      const dir = files.includes(file) ? 'cases' : 'base';
      const path = join(HERE, dir, testCase.id, file);
      if (!existsSync(path) || !readFileSync(path, 'utf8').includes(contains)) {
        problems.push(
          `${where}: ${file} after the case no longer holds ${JSON.stringify(contains)}`,
        );
      }
    }
  }
  return problems;
}

// ---- grade -------------------------------------------------------------------

/** The reviewer's JSON block: the last fenced `json` block, or the whole answer. */
export function parseReview(text) {
  if (!text) return null;
  const candidates = [];
  const open = text.lastIndexOf('```json');
  if (open > -1) {
    // To the answer's last fence, not the first one after the opening: a
    // summary may quote a fence of its own ("``` blocks are rewritten").
    const body = text.slice(text.indexOf('\n', open) + 1);
    candidates.push(body.slice(0, body.lastIndexOf('```')));
    candidates.push(body.slice(0, body.indexOf('```')));
  }
  candidates.push(text);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate.trim());
      if (Array.isArray(parsed.findings)) return parsed;
    } catch {}
  }
  return null;
}

const normalise = (file) =>
  (file ?? '').replace(/^\.?\//, '').replace(/^.*?(?=(apps|packages)\/)/, '');

/**
 * A planted case passes when a P0 or P1 finding sits on one of its files and
 * names the defect (`match`, over the summary). A decoy passes when no P0 or
 * P1 finding sits on any of its files.
 */
export function grade(testCase, review) {
  if (!review) return { parsed: false, pass: false };
  const serious = review.findings.filter((f) => SERIOUS.has(String(f.priority).toUpperCase()));
  const own = new Set([...caseFiles(testCase.id), ...baseFiles(testCase.id)]);
  const onCase = serious.filter((f) => own.has(normalise(f.file)));
  if (testCase.decoyOf) return { parsed: true, pass: onCase.length === 0, noise: onCase.length };
  const match = new RegExp(testCase.expect.match, 'i');
  const hits = onCase.filter(
    (f) => testCase.expect.files.includes(normalise(f.file)) && match.test(f.summary ?? ''),
  );
  return {
    parsed: true,
    pass: hits.length > 0,
    hits: hits.length,
    other: onCase.length - hits.length,
  };
}

export function summarise(entries) {
  const planted = entries.filter((e) => !e.decoy);
  const decoys = entries.filter((e) => e.decoy);
  return {
    caught: `${planted.filter((e) => e.grade.pass).length}/${planted.length}`,
    decoysClean: `${decoys.filter((e) => e.grade.pass).length}/${decoys.length}`,
    unparsed: entries.filter((e) => !e.grade.parsed).length,
    cost_usd: Number(entries.reduce((sum, e) => sum + (e.agent?.cost_usd ?? 0), 0).toFixed(2)),
  };
}

// ---- agent -------------------------------------------------------------------

/** A worktree at `ref` with the cases' base committed, then the cases as one commit. */
function prepare(dir, ref, members, commit) {
  git(ROOT, 'worktree', 'add', '-q', '--detach', dir, ref);
  rmSync(join(dir, 'scripts/evals'), { recursive: true, force: true });
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'eval: hide the evals');
  const older = members.filter((c) => baseFiles(c.id).length);
  for (const testCase of older) cpSync(join(HERE, 'base', testCase.id), dir, { recursive: true });
  if (older.length) {
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'feat: earlier work');
  }
  const base = git(dir, 'rev-parse', 'HEAD');
  for (const testCase of members)
    cpSync(join(HERE, 'cases', testCase.id), dir, { recursive: true });
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', commit);
  return { base, head: git(dir, 'rev-parse', 'HEAD') };
}

/**
 * The runs to make: one per case, or with `--bundles` one per bundle, whose
 * cases land as one branch, the way autoreview meets a real one: several
 * changes, one diff, each graded on its own.
 */
export function unitsOf({ cases, bundles }, { bundles: asBundles, case: only }) {
  if (!asBundles) {
    return cases
      .filter((c) => !only || c.id === only)
      .map((c) => ({ id: c.id, members: [c], task: c.task, commit: c.commit }));
  }
  return bundles
    .filter((b) => !only || b.id === only)
    .map((b) => {
      const members = b.cases.map((id) => {
        const found = cases.find((c) => c.id === id);
        if (!found) throw new Error(`bundle ${b.id}: no case ${id}`);
        return found;
      });
      const tasks = [...new Set(members.map((c) => c.task))];
      return {
        id: b.id,
        members,
        commit: b.commit,
        task: `${b.task}\n${tasks.map((t) => `- ${t}`).join('\n')}`,
      };
    });
}

function review(dir, prompt, { model, timeout }) {
  const started = Date.now();
  return new Promise((done) => {
    const child = spawn(
      'claude',
      ['-p', prompt, '--output-format', 'json', '--model', model, '--allowedTools', REVIEWER_TOOLS],
      {
        cwd: dir,
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let out = '';
    child.stdout.on('data', (chunk) => {
      out += chunk;
    });
    child.stderr.on('data', (chunk) => {
      out += chunk;
    });
    const timer = setTimeout(() => child.kill('SIGTERM'), timeout * 60_000);
    child.on('close', (code) => {
      clearTimeout(timer);
      const summary = { ok: code === 0, seconds: Math.round((Date.now() - started) / 1000) };
      try {
        const line = out
          .trim()
          .split('\n')
          .reverse()
          .find((l) => l.startsWith('{'));
        const json = JSON.parse(line);
        done({
          ...summary,
          cost_usd: json.total_cost_usd,
          turns: json.num_turns,
          result: json.result,
        });
      } catch {
        done({ ...summary, output: out.slice(-3000) });
      }
    });
  });
}

function printEntry(entry) {
  const g = entry.grade;
  const verdict = !g.parsed ? 'UNPARSED' : g.pass ? 'pass' : 'FAIL';
  const detail = entry.decoy
    ? `noise ${g.noise ?? '-'}`
    : `hits ${g.hits ?? '-'}, other ${g.other ?? '-'}`;
  log(
    `  ${verdict.padEnd(8)} ${entry.id}${entry.trial > 1 ? ` #${entry.trial}` : ''} (${detail}, $${entry.agent?.cost_usd?.toFixed?.(2) ?? '?'})`,
  );
}

function save(report) {
  const dir = join(HERE, 'results');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${report.at.replace(/[:.]/g, '-')}-${report.mode}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  log(`report ${relative(ROOT, file)}`);
}

/** What is wrong with the bundles: an unknown case, or two cases writing one path. */
export function validateBundles({ cases, bundles }) {
  const problems = [];
  for (const bundle of bundles) {
    const seen = new Map();
    for (const id of bundle.cases) {
      if (!cases.some((c) => c.id === id)) problems.push(`bundle ${bundle.id}: no case ${id}`);
      for (const file of [...caseFiles(id), ...baseFiles(id)]) {
        if (seen.has(file) && seen.get(file) !== id) {
          problems.push(`bundle ${bundle.id}: ${id} and ${seen.get(file)} both write ${file}`);
        }
        seen.set(file, id);
      }
    }
    if (!bundle.task || !bundle.commit) problems.push(`bundle ${bundle.id}: no task or commit`);
  }
  return problems;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const loaded = loadCases();
  const { prompt, cases } = loaded;

  if (args.mode === 'validate') {
    const problems = [...validateCases(cases), ...validateBundles(loaded)];
    for (const problem of problems) log(`  ✖ ${problem}`);
    log(`${cases.length} cases, ${loaded.bundles.length} bundles: ${problems.length} problem(s)`);
    process.exitCode = problems.length ? 1 : 0;
    return;
  }

  if (args.mode === 'grade') {
    const report = JSON.parse(readFileSync(args.report, 'utf8'));
    for (const entry of report.cases) {
      entry.grade = grade(
        cases.find((c) => c.id === entry.id),
        parseReview(entry.result ?? entry.agent?.result),
      );
      printEntry(entry);
    }
    report.summary = summarise(report.cases);
    report.mode = 'regrade';
    report.at = new Date().toISOString();
    log(JSON.stringify(report.summary));
    save(report);
    return;
  }

  const units = unitsOf(loaded, args);
  if (units.length === 0) throw new Error(`Nothing named ${args.case}`);
  const ref = git(ROOT, 'rev-parse', args.ref);
  const report = {
    mode: args.bundles ? 'bundles' : 'agent',
    model: args.model,
    ref,
    at: new Date().toISOString(),
    cases: [],
  };
  const queue = units.flatMap((unit) =>
    Array.from({ length: args.trials }, (_, i) => ({ unit, trial: i + 1 })),
  );
  const root = join(tmpdir(), `autoreview-eval-${Date.now()}`);
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const { unit, trial } = job;
      const dir = join(root, `${unit.id}-${trial}`);
      try {
        const { base, head } = prepare(dir, ref, unit.members, unit.commit);
        const unitPrompt = prompt
          .replace('{task}', unit.task)
          .replace('{base}', base)
          .replace('{head}', head);
        log(`▶ ${unit.id}${args.trials > 1 ? ` #${trial}` : ''}: ${args.model} reviewing…`);
        const { result, ...agent } = await review(dir, unitPrompt, args);
        const parsed = parseReview(result);
        unit.members.forEach((testCase, i) => {
          // One review grades every case in the unit; its cost counts once.
          const entry = {
            id: testCase.id,
            unit: unit.id,
            trial,
            decoy: Boolean(testCase.decoyOf),
            result,
          };
          if (i === 0) entry.agent = agent;
          entry.grade = grade(testCase, parsed);
          printEntry(entry);
          report.cases.push(entry);
        });
      } finally {
        if (args.keep) log(`kept ${dir}`);
        else spawnSync('git', ['worktree', 'remove', '--force', dir], { cwd: ROOT });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, args.concurrency) }, worker));
  report.cases.sort((a, b) => a.id.localeCompare(b.id) || a.trial - b.trial);
  report.summary = summarise(report.cases);
  log(
    `\ncaught ${report.summary.caught} · decoys clean ${report.summary.decoysClean} · unparsed ${report.summary.unparsed} · $${report.summary.cost_usd}`,
  );
  save(report);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
