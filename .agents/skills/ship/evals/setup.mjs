#!/usr/bin/env node
/**
 * Builds the sandboxes for the `ship` step 4 evals (cases.mjs), one per case:
 *
 *   node .agents/skills/ship/evals/setup.mjs <out-dir> [case ...]
 *
 * Each `<out-dir>/<case>/` holds `origin.git` (a bare remote that refuses
 * non-fast-forward pushes), `work/` (a clone on the pull request's head
 * branch, where the agent works), and `gh/` (the simulated GitHub: gh.mjs,
 * state.json, log.jsonl). `start.json` records the starting SHAs for grading.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { base, cases } from './cases.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const [outArg, ...only] = process.argv.slice(2);
if (!outArg) {
  console.error('usage: setup.mjs <out-dir> [case ...]');
  process.exit(2);
}
const out = resolve(outArg);
const env = {
  ...process.env,
  GIT_AUTHOR_NAME: 'eval',
  GIT_AUTHOR_EMAIL: 'eval@example.com',
  GIT_COMMITTER_NAME: 'eval',
  GIT_COMMITTER_EMAIL: 'eval@example.com',
};

for (const c of cases.filter((c) => only.length === 0 || only.includes(c.id))) {
  const dir = join(out, c.id);
  rmSync(dir, { recursive: true, force: true });
  const gh = join(dir, 'gh');
  const origin = join(gh, 'origin.git');
  const seed = join(dir, 'seed');
  mkdirSync(seed, { recursive: true });
  const run = (cwd, cmd, ...args) => execFileSync(cmd, args, { cwd, env, encoding: 'utf8' }).trim();
  const git = (...args) => run(seed, 'git', ...args);
  const write = (files) => {
    for (const [path, content] of Object.entries(files)) {
      const file = join(seed, path);
      if (content === null) rmSync(file);
      else {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, content);
      }
    }
  };

  run(dir, 'git', 'init', '-q', '--bare', '-b', 'main', origin);
  run(origin, 'git', 'config', 'receive.denyNonFastForwards', 'true');
  run(origin, 'git', 'config', 'receive.denyDeletes', 'true');
  git('init', '-q', '-b', 'main');
  write(base);
  run(seed, 'node', 'gen.mjs');
  git('add', '-A');
  git('commit', '-qm', 'chore: the greeter');

  const verdicts = [];
  const f = {
    branch: (name, from) => (from ? git('checkout', '-qb', name, from) : git('checkout', '-q', name)),
    commit(message, files, { gen = false } = {}) {
      write(files);
      if (gen) run(seed, 'node', 'gen.mjs');
      git('add', '-A');
      git('commit', '-qm', message);
    },
    mergeIn: (ref) => git('merge', '-q', '--no-ff', '-m', `Merge branch '${ref}'`, ref),
    verify: () => verdicts.push({ sha: git('rev-parse', 'HEAD'), result: 'PASS' }),
  };
  const pr = c.build(f);
  const baseRef = pr.base ?? 'main';
  git('-c', 'push.negotiate=false', 'push', '-q', origin, '--all');

  const sha = (ref) => git('rev-parse', ref);
  git('checkout', '-q', pr.head);
  const head = sha(pr.head);
  run(seed, 'node', 'test.mjs');
  if (pr.verified) verdicts.push({ sha: head, result: 'PASS' });
  writeFileSync(
    join(gh, 'state.json'),
    `${JSON.stringify(
      {
        number: 42,
        base: baseRef,
        head: pr.head,
        headRepo: 'JordiParraCrespo/greeter',
        labels: ['ship'],
        verdicts,
        reports: { [head]: { sha: head, green: true } },
        reviews: pr.reviews ?? [],
        threads: pr.threads ?? [],
        unknownReads: pr.unknownReads ?? 0,
        mainRed: false,
        merged: null,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(dir, 'start.json'),
    `${JSON.stringify({ head, base: sha(baseRef), main: sha('main') }, null, 2)}\n`,
  );
  writeFileSync(join(gh, 'log.jsonl'), '');
  copyFileSync(join(here, 'gh.mjs'), join(gh, 'gh.mjs'));
  rmSync(seed, { recursive: true, force: true });

  const work = join(dir, 'work');
  run(dir, 'git', 'clone', '-q', '-b', pr.head, origin, work);
  run(work, 'git', 'config', 'user.name', 'eval');
  run(work, 'git', 'config', 'user.email', 'eval@example.com');
  run(work, 'git', 'config', 'push.negotiate', 'false');
  console.log(`${c.id}: ${dir}`);
}
