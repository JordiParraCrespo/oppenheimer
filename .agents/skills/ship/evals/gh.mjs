#!/usr/bin/env node
/**
 * The simulated GitHub an eval case runs against. `setup.mjs` copies it into
 * each sandbox beside `state.json` (the pull request) and `origin.git` (a bare
 * remote that refuses non-fast-forward pushes). Every call is appended to
 * `log.jsonl`, which `grade.mjs` reads.
 *
 *   node gh.mjs pr                          read the pull request, fresh
 *   node gh.mjs ci                          `pnpm ci:local` on the checkout's HEAD
 *   node gh.mjs verify                      a fresh agent's verdict on the head
 *   node gh.mjs merge --sha <sha> [--method merge|squash|rebase]
 *   node gh.mjs reply <thread> <text>       answer a review thread
 *   node gh.mjs resolve <thread>
 *   node gh.mjs comment <text>              a comment on the pull request
 *   node gh.mjs ask <text>                  a message to the user
 *   node gh.mjs checkin <minutes>           arm a check-in
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const origin = join(here, 'origin.git');
const statePath = join(here, 'state.json');
const state = JSON.parse(readFileSync(statePath, 'utf8'));
const save = () => writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
const log = (entry) =>
  appendFileSync(join(here, 'log.jsonl'), `${JSON.stringify({ at: Date.now(), ...entry })}\n`);
const git = (...args) => execFileSync('git', ['--git-dir', origin, ...args], { encoding: 'utf8' }).trim();
const sha = (ref) => git('rev-parse', `refs/heads/${ref}`);
const conflicts = () =>
  spawnSync('git', ['--git-dir', origin, 'merge-tree', '--write-tree', sha(state.base), sha(state.head)])
    .status !== 0;
const fail = (status, message) => {
  console.error(`HTTP ${status}: ${message}`);
  process.exit(1);
};

function testsAt(commit) {
  const dir = mkdtempSync(join(tmpdir(), 'ship-eval-'));
  try {
    execFileSync('sh', ['-c', `git --git-dir "${origin}" archive ${commit} | tar -x -C "${dir}"`]);
    return spawnSync('node', ['test.mjs'], { cwd: dir, encoding: 'utf8' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const [cmd, ...args] = process.argv.slice(2);
switch (cmd) {
  case 'pr': {
    const head = sha(state.head);
    let mergeable = null;
    let mergeableState = 'unknown';
    if (state.merged) {
      mergeableState = 'merged';
    } else if (state.unknownReads > 0) {
      state.unknownReads -= 1;
    } else if (conflicts()) {
      mergeable = false;
      mergeableState = 'dirty';
    } else {
      mergeable = true;
      const blocked =
        state.threads.some((t) => !t.resolved) || state.reviews.some((r) => r.state === 'CHANGES_REQUESTED');
      mergeableState = blocked ? 'blocked' : 'clean';
    }
    save();
    log({ cmd, head, mergeableState });
    console.log(
      JSON.stringify(
        {
          number: state.number,
          state: state.merged ? 'merged' : 'open',
          labels: state.labels,
          base: { ref: state.base, sha: sha(state.base) },
          head: { ref: state.head, sha: head, repo: state.headRepo },
          mergeable,
          mergeable_state: mergeableState,
          description_local_ci_report: state.reports[head] ?? null,
          verdicts: state.verdicts,
          reviews: state.reviews,
          review_threads: state.threads,
          open_main_red_issues: state.mainRed ? [{ number: 700, title: 'main is red' }] : [],
          merged: state.merged ?? null,
        },
        null,
        2,
      ),
    );
    break;
  }
  case 'ci': {
    const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
    if (dirty) fail(1, 'ci:local refuses uncommitted changes and untracked files');
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const run = spawnSync('node', ['test.mjs'], { encoding: 'utf8' });
    const green = run.status === 0;
    state.reports[head] = { sha: head, green };
    save();
    log({ cmd, sha: head, green });
    console.log(`${run.stdout}${run.stderr}\nLocal CI ${green ? 'passed' : 'FAILED'} on ${head}`);
    console.log('(the description\'s Local CI report names this commit once it is the pushed head)');
    process.exit(green ? 0 : 1);
    break;
  }
  case 'verify': {
    const head = sha(state.head);
    const run = testsAt(head);
    const result = run.status === 0 ? 'PASS' : 'FAIL';
    state.verdicts.push({ sha: head, result });
    save();
    log({ cmd, sha: head, result });
    console.log(`Fresh agent verdict on ${head}: ${result}\n${run.stdout}${run.stderr}`);
    break;
  }
  case 'merge': {
    const want = args[args.indexOf('--sha') + 1];
    const method = args.includes('--method') ? args[args.indexOf('--method') + 1] : 'merge';
    const head = sha(state.head);
    log({ cmd, sha: want, method, head });
    if (state.merged) fail(405, 'Pull request is already merged');
    if (!args.includes('--sha')) fail(422, '--sha is required');
    if (want !== head) fail(409, 'Head branch was modified. Review and try the merge again.');
    if (conflicts()) fail(405, 'Pull request is not mergeable');
    state.merged = { sha: head, method };
    save();
    console.log(`Merged #${state.number} at ${head} (${method})`);
    break;
  }
  case 'reply':
  case 'resolve': {
    const thread = state.threads.find((t) => t.id === args[0]);
    if (!thread) fail(404, `no thread ${args[0]}`);
    if (cmd === 'resolve') thread.resolved = true;
    else thread.replies.push(args.slice(1).join(' '));
    save();
    log({ cmd, thread: args[0], text: args.slice(1).join(' ') });
    console.log('ok');
    break;
  }
  case 'comment':
  case 'ask':
  case 'checkin':
    log({ cmd, text: args.join(' ') });
    console.log('ok');
    break;
  default:
    fail(400, `unknown command ${cmd}; see the header of gh.mjs`);
}
