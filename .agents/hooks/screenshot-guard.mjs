#!/usr/bin/env node
// Stop hook: a branch that changes what the console looks like does not end
// a task without screenshots of it. The pictures are the `local-stack`
// skill's "Show a visual change" step (`pnpm screens`); this only checks
// that they are of the code as it is now.
//
// What is visual, and the fingerprint of the branch's visual change, are
// `visual-change.mjs`. Two files answer it, when they carry the current
// fingerprint:
//
// - `.screenshots/manifest.json`, which `pnpm screens` writes after each run;
// - `.screenshots/not-visual.md`, which `pnpm screens --not-visual "<why>"`
//   writes for a change that matches and does not show (a renamed prop, a
//   hook's internals). The same line belongs in the PR.
//
// It blocks once per stop: `stop_hook_active` lets the second stop through,
// so a turn that is only a question to the user is never held. Cases are in
// `.agents/hooks/screenshot-guard.test.mjs`.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { visualChange } from './visual-change.mjs';

const FINGERPRINT = /fingerprint[":\s]+([0-9a-f]{16})/;

function recorded(path) {
  try {
    return readFileSync(path, 'utf8').match(FINGERPRINT)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** The message that holds the stop, or null when the branch is covered. */
export function verdict(root, options) {
  const change = visualChange(root, options);
  if (!change) return null;
  const answers = ['manifest.json', 'not-visual.md'].map((name) =>
    recorded(join(root, '.screenshots', name)),
  );
  if (answers.includes(change.fingerprint)) return null;
  const listed = change.files.slice(0, 8).join(', ');
  const more = change.files.length > 8 ? ` and ${change.files.length - 8} more` : '';
  return [
    `This branch changes what the console looks like (${listed}${more}) and has no screenshots of it as it is now.`,
    // oppenheimer:begin e2e
    'Before you finish: follow the `local-stack` skill\'s "Show a visual change" step (`node scripts/stack/stack.mjs up --web`, then `pnpm screens <route>...`), look at every picture, show them to the user, and give the pull request its `## Screenshots` section.',
    'If the change is not visual after all, run `pnpm screens --not-visual "<why>"` and say the same in the pull request.',
    // oppenheimer:end e2e
    'If this turn only asks the user something, or the work is not ready yet, say so and stop again.',
  ].join(' ');
}

function main() {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {}
  if (input.stop_hook_active) return;
  let root;
  try {
    root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: input.cwd ?? process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return;
  }
  let reason = null;
  try {
    reason = verdict(root);
  } catch {
    // No main to compare against (a shallow clone): nothing to check.
    return;
  }
  if (reason) process.stdout.write(`${JSON.stringify({ decision: 'block', reason })}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
