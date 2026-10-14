#!/usr/bin/env node
/**
 * What changed in the design export since the last port: the first step of
 * an autonomous run. Reads `last-port.json` beside this skill (the export
 * sync commit the design system last caught up with), finds the sync
 * commits on HEAD after it, and prints, as Markdown, the frames that are
 * new, changed or gone between the two, with each changed frame's line
 * count and the names of its Claude Design props (the states to render),
 * and the lines the sync commits added to the export's README (its own note
 * on the delta).
 *
 *   node export-delta.mjs [--design product/versions/mvp/design] [--version version1] [--json]
 *
 * Exits 0 and prints "Up to date" when no sync landed since the last port.
 * It reads git only; it writes nothing. The port's pull request updates
 * `last-port.json` to the sync commit it ported.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, args } from './lib/browser.mjs';

const a = args({
  design: { default: 'product/versions/mvp/design' },
  version: { default: 'version1' },
  json: { type: 'boolean', default: false },
});
const git = (...argv) => execFileSync('git', argv, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }).trim();
const state = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'last-port.json'), 'utf8'));
const frames = `${a.design}/${a.version}`;

// A sync commit is the one that copies an export in; its subject says so.
const syncs = git('log', '--format=%H%x09%ad%x09%s', '--date=short', `${state.export}..HEAD`, '--', a.design)
  .split('\n')
  .filter(Boolean)
  .map((line) => line.split('\t'))
  .filter(([, , subject]) => /sync the .*export/i.test(subject))
  .map(([sha, date, subject]) => ({ sha, date, subject }));

if (syncs.length === 0) {
  const msg = `Up to date: no export sync since ${state.label} (${state.export.slice(0, 8)}).`;
  console.log(a.json ? JSON.stringify({ upToDate: true, last: state }) : msg);
  process.exit(0);
}

const latest = syncs[0];
const changes = git('diff', '--name-status', '--find-renames', state.export, latest.sha, '--', frames)
  .split('\n')
  .filter(Boolean)
  .map((line) => line.split('\t'))
  .filter(([, path]) => !path.includes('/assets/') || path.endsWith('.svg'));

const delta = { added: [], changed: [], removed: [] };
for (const [status, path, renamed] of changes) {
  const file = (renamed ?? path).slice(frames.length + 1);
  if (status.startsWith('A')) delta.added.push(file);
  else if (status.startsWith('D')) delta.removed.push(file);
  else delta.changed.push(file);
}

/** Lines added and removed in one frame, and the props it declares at the new commit. */
function detail(file) {
  const path = `${frames}/${file}`;
  const stat = git('diff', '--numstat', state.export, latest.sha, '--', path).split('\t');
  let props = '';
  if (file.endsWith('.html')) {
    try {
      const html = git('show', `${latest.sha}:${path}`);
      const raw = (html.match(/data-props="([^"]*)"/) ?? [])[1];
      if (raw) props = Object.keys(JSON.parse(raw.replaceAll('&quot;', '"').replaceAll('&amp;', '&'))).join(', ');
    } catch {}
  }
  return { file, added: Number(stat[0]) || 0, removed: Number(stat[1]) || 0, props };
}

// Only what the syncs themselves added: notes written by later ports would
// otherwise read as the export's own.
const readmeAdded = syncs
  .toReversed()
  .flatMap((s) =>
    git('show', '--format=', '--unified=0', s.sha, '--', `${a.design}/README.md`)
      .split('\n')
      .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
      .map((l) => l.slice(1)),
  )
  .join('\n');

const report = {
  last: state,
  latest,
  syncs,
  added: delta.added.map(detail),
  changed: delta.changed.map(detail),
  removed: delta.removed,
  readmeAdded,
};

if (a.json) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const row = (d) => `| \`${d.file}\` | +${d.added} −${d.removed} | ${d.props} |`;
const out = [
  `# Export delta: ${state.label} → ${latest.date}`,
  '',
  `Last port: \`${state.export.slice(0, 8)}\` (${state.label}${state.pr ? `, PR #${state.pr}` : ''}).`,
  `Syncs since: ${syncs.map((s) => `\`${s.sha.slice(0, 8)}\` ${s.date}`).join(', ')}. Port up to \`${latest.sha.slice(0, 8)}\`.`,
  '',
];
for (const [title, list] of [
  ['New frames', report.added],
  ['Changed frames', report.changed],
]) {
  if (list.length === 0) continue;
  out.push(`## ${title}`, '', '| Frame | Lines | Props |', '| --- | --- | --- |', ...list.map(row), '');
}
if (report.removed.length) out.push('## Removed frames', '', ...report.removed.map((f) => `- \`${f}\``), '');
if (readmeAdded) out.push("## What the export's README added", '', readmeAdded, '');
console.log(out.join('\n'));
