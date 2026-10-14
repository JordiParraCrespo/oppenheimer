// What counts as a change to what the console shows, and a fingerprint of
// that change. The one definition: the screenshot guard
// (`screenshot-guard.mjs`), the camera (`scripts/stack/screens.mjs`) and the
// pr-screenshots eval all import it, and the prose in AGENTS.md, the
// `local-stack` and `steward` skills and `.agents/rules/frontend-ui.md`
// points here rather than restating the list.
//
// The fingerprint is a hash of each visual file the branch changes, by
// content. Screenshots record it when they are taken; they are of this code
// while it still matches. Committing, a checkout or `touch` leave it alone;
// an edit, a reformat or a merge that changes one of those files does not.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Paths whose change shows on screen: the console, the platform kit, the design system, the copy. */
export const VISUAL = [
  // oppenheimer:begin web
  /^apps\/web\/src\//,
  /^apps\/web\/public\//,
  /^apps\/web\/index\.html$/,
  /^packages\/frontend\/web\/src\//,
  /^packages\/frontend\/design-system\/web\/src\//,
  /^packages\/translations\/.+\.json$/,
  // oppenheimer:end web
];
/** Beside them, but never on screen: tests, stories, docs. */
export const NOT_VISUAL = [/\/__tests__\//, /\.(spec|test|stories)\.[cm]?[jt]sx?$/, /\.md$/];

/** Whether a repo-relative path is one whose change shows on screen. */
export function isVisual(path) {
  return VISUAL.some((re) => re.test(path)) && !NOT_VISUAL.some((re) => re.test(path));
}

function git(root, ...args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

/**
 * A checkout's `origin/main` can be older than the `main` the branch was cut
 * from, and diffing against it counts main's own commits as the branch's. So
 * it is fetched first, briefly, at most every ten minutes; offline, the refs
 * already here are used.
 */
export function refreshMain(root) {
  const stamp = join(git(root, 'rev-parse', '--absolute-git-dir').trim(), 'visual-change-fetch');
  if (existsSync(stamp) && Date.now() - statSync(stamp).mtimeMs < 600_000) return;
  try {
    execFileSync('git', ['fetch', '--quiet', '--no-tags', 'origin', 'main'], {
      cwd: root,
      stdio: 'ignore',
      timeout: 8_000,
    });
  } catch {}
  try {
    writeFileSync(stamp, '');
  } catch {}
}

/** Where the branch left main: the nearer merge-base of `origin/main` and `main`. */
export function branchBase(root) {
  const bases = [];
  for (const ref of ['origin/main', 'main']) {
    try {
      const base = git(root, 'merge-base', ref, 'HEAD').trim();
      bases.push({ base, ahead: Number(git(root, 'rev-list', '--count', `${base}..HEAD`)) });
    } catch {}
  }
  if (bases.length === 0) throw new Error('no main to compare against');
  return bases.sort((a, b) => a.ahead - b.ahead)[0].base;
}

/**
 * The visual files the branch changes, committed or not, and their
 * fingerprint; null when there are none. Throws when there is no main.
 */
export function visualChange(root, { fetch = true } = {}) {
  if (fetch) refreshMain(root);
  const base = branchBase(root);
  const committed = git(root, 'diff', '--name-only', `${base}..HEAD`).split('\n');
  const pending = git(root, 'status', '--porcelain', '--untracked-files=all')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).split(' -> ').at(-1));
  const files = [...new Set([...committed, ...pending])].filter(isVisual).sort();
  if (files.length === 0) return null;
  const present = files.filter((file) => existsSync(join(root, file)));
  const blobs = present.length
    ? git(root, 'hash-object', '--', ...present).trim().split('\n')
    : [];
  const blobOf = new Map(present.map((file, i) => [file, blobs[i]]));
  const hash = createHash('sha256');
  for (const file of files) hash.update(`${file}\0${blobOf.get(file) ?? 'deleted'}\n`);
  return { base, files, fingerprint: hash.digest('hex').slice(0, 16) };
}
