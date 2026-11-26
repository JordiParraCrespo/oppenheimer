#!/usr/bin/env node
/**
 * A branch that changes a product note also changes what is kept in sync with
 * it: `product/brief.html`, regenerated from the notes, and
 * the log of decisions that changed, `product/decisions.md`. Nothing else notices a note
 * that moved without them.
 *
 * An edit that changes no decision and nothing the brief says (a typo, a
 * link) says so in a commit on the branch, with a trailer:
 *
 *   Product-Sync: fixes a typo in bots.md; no decision or brief text changes
 *
 * Run: node scripts/check-product-sync.mjs [--base <ref>]   (default origin/main)
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** The notes the brief and the decision list are kept in sync with. */
const NOTE = /^product\/(design\/.+|archive\/.+|roadmap)\.md$/;
const BRIEF = 'product/brief.html';
const DECISIONS = 'product/decisions.md';
const TRAILER = /^Product-Sync:[ \t]*\S/m;

/**
 * @param {{ changed: string[], messages: string[] }} branch the files the branch
 *   changes against its base, and its commit messages
 * @returns {string[]} what is out of sync, empty when nothing is
 */
export function productSyncProblems({ changed, messages }) {
  const notes = changed.filter((path) => NOTE.test(path));
  if (notes.length === 0) return [];
  if (messages.some((message) => TRAILER.test(message))) return [];
  const missing = [BRIEF, DECISIONS].filter((path) => !changed.includes(path));
  if (missing.length === 0) return [];
  return [
    `${notes.join(', ')} changed, but ${missing.join(' and ')} did not. ` +
      `Regenerate the brief and add the decision's line, or say why neither changes ` +
      `in a commit trailer: "Product-Sync: <why>".`,
  ];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const at = process.argv.indexOf('--base');
  const base = at > -1 ? process.argv[at + 1] : 'origin/main';
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
  let from;
  try {
    from = git('merge-base', 'HEAD', base).trim();
  } catch {
    console.log(`Product sync: no ${base} to compare with; skipped.`);
    process.exit(0);
  }
  const changed = git('diff', '--name-only', `${from}...HEAD`).split('\n').filter(Boolean);
  const messages = git('log', '--format=%B%x00', `${from}..HEAD`).split('\0');
  const problems = productSyncProblems({ changed, messages });
  if (problems.length) {
    for (const problem of problems) console.error(`  ✖ ${problem}`);
    process.exit(1);
  }
  console.log('Product sync: the brief and the decision list move with the notes.');
}
