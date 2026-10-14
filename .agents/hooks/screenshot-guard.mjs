#!/usr/bin/env node
// Stop hook: a branch that changes what the console looks like does not end
// a task without screenshots of it. The pictures are the `local-stack`
// skill's "Show a visual change" step (`.screenshots/`, taken by
// `e2e/tests/screens`); this only checks that they exist and are newer than
// the last visual change.
//
// A change is visual when the branch, against `origin/main`, touches the
// console's source, its static files, the platform kit, the design system or
// the translations; tests, stories and docs beside them are not. The newest
// such change is the later of its last commit on the branch and the mtime of
// any file still uncommitted. Two files answer it, when newer:
//
// - `.screenshots/manifest.json`, which the camera writes after each run;
// - `.screenshots/not-visual.md`, a line saying why a change that matches is
//   not one (a renamed prop, a hook's internals). It belongs in the PR too.
//
// It blocks once per stop: `stop_hook_active` lets the second stop through,
// so a turn that is only a question to the user is never held. Cases are in
// `.agents/hooks/screenshot-guard.test.mjs`.

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VISUAL = [
  // oppenheimer:begin web
  /^apps\/web\/src\//,
  /^apps\/web\/public\//,
  /^apps\/web\/index\.html$/,
  /^packages\/frontend\/web\/src\//,
  /^packages\/frontend\/design-system\/web\/src\//,
  /^packages\/translations\/.+\.json$/,
  // oppenheimer:end web
];
const NOT_VISUAL = [/\/__tests__\//, /\.(spec|test|stories)\.[cm]?[jt]sx?$/, /\.md$/];

/** Whether a repo-relative path is one whose change shows on screen. */
export function isVisual(path) {
  return VISUAL.some((re) => re.test(path)) && !NOT_VISUAL.some((re) => re.test(path));
}

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

function mtime(path) {
  try {
    return statSync(path).mtimeMs / 1000;
  } catch {
    return 0;
  }
}

/** The visual files the branch changes and when the newest of them changed, or null. */
export function visualChange(root, base = 'origin/main') {
  const mergeBase = git(root, 'merge-base', base, 'HEAD').trim();
  const committed = git(root, 'diff', '--name-only', `${mergeBase}..HEAD`).split('\n');
  const pending = git(root, 'status', '--porcelain', '--untracked-files=all')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).split(' -> ').at(-1));
  const committedVisual = committed.filter(isVisual);
  const pendingVisual = pending.filter(isVisual);
  const files = [...new Set([...committedVisual, ...pendingVisual])];
  if (files.length === 0) return null;
  const lastCommit = committedVisual.length
    ? Number(git(root, 'log', '-1', '--format=%ct', `${mergeBase}..HEAD`, '--', ...committedVisual))
    : 0;
  const lastEdit = Math.max(0, ...pendingVisual.map((file) => mtime(join(root, file))));
  return { files, changedAt: Math.max(lastCommit, lastEdit) };
}

/** The message that holds the stop, or null when the branch is covered. */
export function verdict(root) {
  const change = visualChange(root);
  if (!change) return null;
  const shots = mtime(join(root, '.screenshots/manifest.json'));
  const waiver = mtime(join(root, '.screenshots/not-visual.md'));
  if (Math.max(shots, waiver) >= change.changedAt) return null;
  const listed = change.files.slice(0, 8).join(', ');
  const more = change.files.length > 8 ? ` and ${change.files.length - 8} more` : '';
  return [
    `This branch changes what the console looks like (${listed}${more}) and has no screenshots newer than the change.`,
    // oppenheimer:begin e2e
    'Before you finish: follow the `local-stack` skill\'s "Show a visual change" step (stack up --web, `SCREENS=... pnpm --filter @oppenheimer/e2e screens`), look at every picture, show them to the user, and give the pull request its `## Screenshots` section.',
    // oppenheimer:end e2e
    'If the change is not visual after all, write one line saying why to `.screenshots/not-visual.md` and say the same in the pull request.',
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
    root = git(input.cwd ?? process.cwd(), 'rev-parse', '--show-toplevel').trim();
  } catch {
    return;
  }
  let reason = null;
  try {
    reason = verdict(root);
  } catch {
    // No origin/main, a shallow clone: nothing to compare against.
    return;
  }
  if (reason) process.stdout.write(`${JSON.stringify({ decision: 'block', reason })}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
