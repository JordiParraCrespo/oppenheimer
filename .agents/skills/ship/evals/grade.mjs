#!/usr/bin/env node
/**
 * Grades the sandboxes setup.mjs built, after an agent has worked each one:
 *
 *   node .agents/skills/ship/evals/grade.mjs <out-dir> [case ...]
 *
 * Prints a Markdown table, one row per expectation, and exits non-zero when
 * any fails. It reads only the remote, the simulated GitHub's state and its
 * call log, never what the agent says it did.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { cases } from './cases.mjs';

const [outArg, ...only] = process.argv.slice(2);
const out = resolve(outArg ?? '.');
let failed = 0;
console.log('| Case | Expectation | Result |\n| --- | --- | --- |');

for (const c of cases.filter((c) => only.length === 0 || only.includes(c.id))) {
  const dir = join(out, c.id);
  if (!existsSync(dir)) continue;
  const origin = join(dir, 'gh', 'origin.git');
  const git = (...args) => execFileSync('git', ['--git-dir', origin, ...args], { encoding: 'utf8' }).trim();
  const state = JSON.parse(readFileSync(join(dir, 'gh', 'state.json'), 'utf8'));
  const start = JSON.parse(readFileSync(join(dir, 'start.json'), 'utf8'));
  const log = readFileSync(join(dir, 'gh', 'log.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const mergeIndex = state.merged
    ? log.findLastIndex((e) => e.cmd === 'merge' && e.sha === state.merged.sha)
    : -1;
  const before = (i) => mergeIndex === -1 || i < mergeIndex;

  const r = {
    state,
    start,
    final: { head: git('rev-parse', `refs/heads/${state.head}`) },
    method: state.merged?.method,
    mergedAt: (sha) => state.merged?.sha === sha,
    ancestor: (a, b) =>
      spawnSync('git', ['--git-dir', origin, 'merge-base', '--is-ancestor', a, b]).status === 0,
    show: (sha, path) => {
      try {
        return git('show', `${sha}:${path}`);
      } catch {
        return '';
      }
    },
    testsPass(sha) {
      const tmp = mkdtempSync(join(tmpdir(), 'ship-grade-'));
      try {
        execFileSync('sh', ['-c', `git --git-dir "${origin}" archive ${sha} | tar -x -C "${tmp}"`]);
        return spawnSync('node', ['test.mjs'], { cwd: tmp }).status === 0;
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    },
    calls: (cmd) => log.filter((e) => e.cmd === cmd).length,
    asked: (re) => log.some((e) => e.cmd === 'ask' && re.test(e.text)),
    before: (a, b) => {
      const i = log.findIndex((e) => e.cmd === a);
      const j = b === 'merge' ? mergeIndex : log.findIndex((e) => e.cmd === b);
      return i !== -1 && j !== -1 && i < j;
    },
    ciGreenBeforeMerge: (sha) => log.some((e, i) => e.cmd === 'ci' && e.sha === sha && e.green && before(i)),
    verifiedBeforeMerge: (sha) =>
      log.some((e, i) => e.cmd === 'verify' && e.sha === sha && e.result === 'PASS' && before(i)),
  };

  for (const [expectation, check] of c.checks) {
    let ok = false;
    try {
      ok = Boolean(check(r));
    } catch {}
    if (!ok) failed++;
    console.log(`| ${c.id} | ${expectation} | ${ok ? '✅' : '❌'} |`);
  }
}
process.exit(failed ? 1 : 0);
