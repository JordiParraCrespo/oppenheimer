#!/usr/bin/env node
/**
 * What changed in the design export since the last port: the first step of
 * an autonomous run. Reads `last-port.json` beside this skill (the export
 * sync commit the design system last caught up with), fetches `--ref`
 * (`origin/main`), finds the sync commits on it after that one, and prints, as Markdown, the frames that are
 * new, changed or gone between the two, with each changed frame's line
 * count and the names of its Claude Design props (the states to render),
 * and the lines the sync commits added to the export's README (its own note
 * on the delta).
 *
 *   node export-delta.mjs [--ref origin/main] [--design product/versions/mvp/design] [--version version1] [--json]
 *
 * Exits 0 and prints "Up to date" when no sync landed since the last port.
 * It writes nothing but the fetch; the branch you are on does not matter. The port's pull request updates
 * `last-port.json` to the sync commit it ported.
 *
 * The contract it relies on, and fails loudly when broken:
 * - A sync is a commit whose subject matches SYNC_SUBJECT, the form every
 *   sync so far has used: `docs(design): sync the version-1 export of
 *   2026-10-14`. A commit that changes the frames under any other subject
 *   is listed as unrecognised, so a sync named another way is seen, never
 *   skipped.
 * - A frame's props are the JSON in its `data-props` attribute, quoted the
 *   way Claude Design writes it (`&quot;`). A frame whose attribute does not
 *   parse stops the run with its name.
 * Every file under the frames directory is reported, assets included.
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
  ref: { default: 'origin/main' },
});
const git = (...argv) => execFileSync('git', argv, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }).trim();
const state = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'last-port.json'), 'utf8'));
const frames = `${a.design}/${a.version}`;

// The branch may predate the latest sync; the delta is against the base.
const [remote, ...branch] = a.ref.split('/');
if (branch.length) git('fetch', '--quiet', remote, branch.join('/'));
const SYNC_SUBJECT = /^docs\(design\): sync the .+ export of /;

const commits = git('log', '--format=%H%x09%ad%x09%s', '--date=short', `${state.export}..${a.ref}`, '--', frames)
  .split('\n')
  .filter(Boolean)
  .map((line) => line.split('\t'))
  .map(([sha, date, subject]) => ({ sha, date, subject }));
const syncs = commits.filter((c) => SYNC_SUBJECT.test(c.subject));
const unrecognised = commits.filter((c) => !SYNC_SUBJECT.test(c.subject) && !c.subject.startsWith('Merge '));

if (syncs.length === 0) {
  const lines = [`Up to date: no export sync since ${state.label} (${state.export.slice(0, 8)}).`];
  if (unrecognised.length)
    lines.push('', 'These commits changed the frames under another subject; read them before calling it up to date:', ...unrecognised.map((c) => `- \`${c.sha.slice(0, 8)}\` ${c.date} ${c.subject}`));
  console.log(a.json ? JSON.stringify({ upToDate: true, last: state, unrecognised }) : lines.join('\n'));
  process.exit(0);
}

const latest = syncs[0];
const changes = git('diff', '--name-status', '--find-renames', state.export, latest.sha, '--', frames)
  .split('\n')
  .filter(Boolean)
  .map((line) => line.split('\t'));

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
    const raw = git('show', `${latest.sha}:${path}`).match(/data-props="([^"]*)"/)?.[1];
    if (raw !== undefined) {
      try {
        props = Object.keys(JSON.parse(raw.replaceAll('&quot;', '"').replaceAll('&amp;', '&'))).join(', ');
      } catch (e) {
        throw new Error(`${file}: data-props is not JSON (${e.message}); the props contract above no longer holds`);
      }
    }
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
  unrecognised,
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
if (unrecognised.length)
  out.push(
    '## Commits that changed the frames under another subject',
    '',
    'Read these: one may be a sync named another way, or an edit the port must keep.',
    '',
    ...unrecognised.map((c) => `- \`${c.sha.slice(0, 8)}\` ${c.date} ${c.subject}`),
    '',
  );
if (readmeAdded) out.push("## What the export's README added", '', readmeAdded, '');
console.log(out.join('\n'));
