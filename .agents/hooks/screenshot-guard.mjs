#!/usr/bin/env node
// PreToolUse hook: a branch that changes what the console looks like is not
// pushed, and its pull request is not opened or updated, without screenshots
// of it. The pictures are the `local-stack` skill's "Show a visual change"
// step (`pnpm screens`); this only checks that they are of the code as it is
// now.
//
// It gates the moments the rule is about, and nothing else: a Bash call that
// runs `git push` or `gh pr create`/`gh pr edit` (however it is spelled; the
// command is read with `git-guard.mjs`'s parser), and the GitHub MCP tools
// that create or update a pull request. A turn that ends, asks the user
// something or is still mid-change is never held.
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
// A run that photographs nothing by design sets
// `OPPENHEIMER_SCREENSHOT_GUARD=off` (the audit eval's agent, whose cases
// change `apps/web`). Cases are in `.agents/hooks/screenshot-guard.test.mjs`.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { commands, gitInvocation } from './git-guard.mjs';
import { visualChange } from './visual-change.mjs';

const FINGERPRINT = /fingerprint[":\s]+([0-9a-f]{16})/;
/** The MCP tools that open or change a pull request, on any GitHub server. */
const PULL_REQUEST_TOOL = /^mcp__.*github.*__(create|update)_pull_request$/;

function recorded(path) {
  try {
    return readFileSync(path, 'utf8').match(FINGERPRINT)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Whether `words` run `gh pr create` or `gh pr edit`. */
function ghPullRequest(words) {
  let i = 0;
  while (i < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i])) i += 1;
  if (basename(words[i] ?? '') !== 'gh') return false;
  // `gh -R owner/repo pr create`: global options may come before `pr`.
  const pr = words.indexOf('pr', i + 1);
  return pr !== -1 && ['create', 'edit'].includes(words[pr + 1]);
}

/** What the tool call publishes, or null when it publishes nothing this guard covers. */
export function publishes(toolName, toolInput) {
  if (PULL_REQUEST_TOOL.test(toolName ?? '')) return 'opens or updates a pull request';
  if (toolName !== 'Bash' || typeof toolInput?.command !== 'string') return null;
  for (const words of commands(toolInput.command)) {
    if (gitInvocation(words)?.subcommand === 'push') return 'pushes the branch';
    if (ghPullRequest(words)) return 'opens or updates a pull request';
  }
  return null;
}

/** The message that refuses the call, or null when the branch is covered. */
export function verdict(root, options) {
  // A checkout pruned of the camera (`/starter-init` without e2e) has nothing to ask for.
  if (!existsSync(join(root, 'scripts/stack/screens.mjs'))) return null;
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
    'Before you push it or open or update its pull request: follow the `local-stack` skill\'s "Show a visual change" step (`node scripts/stack/stack.mjs up --web`, then `pnpm screens <route>...`), look at every picture, show them to the user, and give the pull request its `## Screenshots` section.',
    'If the change is not visual after all, run `pnpm screens --not-visual "<why>"` and say the same in the pull request.',
    // oppenheimer:end e2e
  ].join(' ');
}

function main() {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {}
  const action = publishes(input.tool_name, input.tool_input);
  if (!action) return;
  // A run that photographs nothing by design (the audit eval's worktrees).
  if (process.env.OPPENHEIMER_SCREENSHOT_GUARD === 'off') return;
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
  if (!reason) return;
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `This call ${action}. ${reason}`,
    },
  };
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
