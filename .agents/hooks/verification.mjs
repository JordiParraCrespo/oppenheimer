// What a branch must have been checked against before it is published, beside
// its screenshots: the one definition, read by the verification guard
// (`verify-guard.mjs`), by `scripts/stack/stack.mjs verified|skip` and by the
// bot evals (`scripts/evals/bot-turn.ts`), which record what they cover.
//
// Two checks, each a set of paths, the fingerprint of the branch's change to
// them (`changeOf` in `visual-change.mjs`) and the file that answers it:
//
// - `stack`: code that runs in the product (the API, the runner, the console,
//   the packages they import). In a cloud session (`CLAUDE_CODE_REMOTE=true`),
//   where the SessionStart hook brought the local stack up, it is answered by
//   `.stack/verified.md`: `node scripts/stack/stack.mjs verified "<what you
//   ran and saw>"` (which needs the API answering), or `… skip "<why>"`.
// - `evals`: anything agentic, i.e. what a model is shown or can call: the
//   bots (prompts, tools, policies), the agent engines and the LLM package,
//   and the other features that ask a model (session titles, the voice
//   polish, pull request briefs). Everywhere, answered by `.evals/passed.json`:
//   an eval (`pnpm eval:*`, `scripts/evals/`) that exits green records itself
//   there (`recordEvalOnSuccess`), or `node scripts/evals/record.mjs --skip "<why>"`.
//
// A record answers the change it was made for: its fingerprint is of what
// those files say, so an edit to a comment or a reformat keeps it, an edit
// to the code does not.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { changeOf } from './visual-change.mjs';

/**
 * Beside the code, never what runs: tests, stories, docs, eval reports. A
 * prompt is Markdown and is what a model reads, so it is not a doc.
 */
const NOT_RUNTIME = [
  /\/__tests__\//,
  /\.(spec|test|stories)\.[cm]?[jt]sx?$/,
  /^(?!.*\/prompts\/).*\.md$/,
  /_test\.go$/,
  /\/evals\/.*\/reports\//,
];

export const CHECKS = {
  stack: {
    title: 'on the local stack',
    paths: [
      /^apps\/api\/src\//,
      // oppenheimer:begin runner
      /^apps\/runner\/(?!docs\/)/,
      /^packages\/go\//,
      // oppenheimer:end runner
      // oppenheimer:begin web
      /^apps\/web\/src\//,
      // oppenheimer:end web
      /^packages\/shared\/src\//,
      /^packages\/backend\/[^/]+\/src\//,
      /^packages\/frontend\/[^/]+\/src\//,
      /^packages\/frontend\/design-system\/web\/src\//,
    ],
    record: '.stack/verified.md',
    // A laptop runs what its owner chooses; a cloud session has the stack up.
    applies: () => process.env.CLAUDE_CODE_REMOTE === 'true',
  },
  evals: {
    title: 'by an eval',
    paths: [
      /^apps\/api\/src\/bots-chat\//,
      /^apps\/api\/src\/bots\/domain\//,
      /^packages\/backend\/agents\/src\//,
      /^packages\/backend\/llm\/src\//,
      /^apps\/api\/src\/[^/]+\/domain\/prompts\//,
      /^apps\/api\/src\/sessions\/domain\/session-name\.policy\.ts$/,
      /^apps\/api\/src\/sessions\/application\/session-naming\.resolver\.ts$/,
      /^apps\/api\/src\/voice\/(application\/voice-polish|infrastructure\/polish-llm)/,
      /^apps\/api\/src\/pull-requests\/application\/pull-request-brief\.resolver\.ts$/,
    ],
    record: '.evals/passed.json',
    applies: () => true,
  },
};

export function matcher(check) {
  return (path) =>
    check.paths.some((re) => re.test(path)) && !NOT_RUNTIME.some((re) => re.test(path));
}

/** The branch's change to `name`'s paths: `{ files, fingerprint }`, or null. */
export function changeFor(root, name, options) {
  return changeOf(root, matcher(CHECKS[name]), options);
}

/** The fingerprints the record for `name` answers. */
export function recorded(root, name) {
  try {
    const text = readFileSync(join(root, CHECKS[name].record), 'utf8');
    return [...text.matchAll(/fingerprint[":\s]+([0-9a-f]{16})/g)].map((m) => m[1]);
  } catch {
    return [];
  }
}

/** Writes the record for `name` as answering the branch's change now; returns it, or null. */
export function record(root, name, entry, options) {
  const change = changeFor(root, name, options);
  if (!change) return null;
  const path = join(root, CHECKS[name].record);
  mkdirSync(dirname(path), { recursive: true });
  if (path.endsWith('.json')) {
    let entries = [];
    try {
      entries = JSON.parse(readFileSync(path, 'utf8')).entries ?? [];
    } catch {}
    entries = [
      ...entries.filter((e) => e.fingerprint === change.fingerprint),
      { ...entry, at: new Date().toISOString(), fingerprint: change.fingerprint },
    ];
    writeFileSync(path, `${JSON.stringify({ entries }, null, 2)}\n`);
  } else {
    const previous =
      existsSync(path) && recorded(root, name).includes(change.fingerprint)
        ? readFileSync(path, 'utf8').trimEnd().split('\n\nfingerprint:')[0]
        : '';
    const body = [previous, `- ${new Date().toISOString()} ${entry.kind}: ${entry.note}`]
      .filter(Boolean)
      .join('\n');
    writeFileSync(path, `${body}\n\nfingerprint: ${change.fingerprint}\n`);
  }
  return change;
}

/** What the branch at `root` still owes before it is published: one sentence per check. */
export function owed(root, options) {
  const out = [];
  for (const [name, check] of Object.entries(CHECKS)) {
    if (!check.applies()) continue;
    const change = changeFor(root, name, options);
    if (!change || recorded(root, name).includes(change.fingerprint)) continue;
    const listed = change.files.slice(0, 6).join(', ');
    const more = change.files.length > 6 ? ` and ${change.files.length - 6} more` : '';
    out.push({ name, text: `It changes ${listed}${more} and has not been checked ${check.title} as it is now.` });
  }
  return out;
}

let recording = false;
/**
 * Called by an eval once it has run: when the process then exits 0, the
 * eval is recorded as having checked the branch's agentic change as it is
 * now. `scripts/evals/bot-turn.ts`'s `writeReport` calls it for every bot
 * eval; an eval with a runner of its own calls it itself.
 */
export function recordEvalOnSuccess(root, name) {
  if (recording) return;
  recording = true;
  process.on('exit', (code) => {
    if (code !== 0) return;
    try {
      const change = record(root, 'evals', { eval: name, args: process.argv.slice(2).join(' ') });
      if (change) console.log(`Recorded in .evals/passed.json for ${change.files.length} changed agentic files.`);
    } catch {
      // No main to compare against: nothing for the guard to read.
    }
  });
}
