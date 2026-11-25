#!/usr/bin/env node
// PreToolUse hook: a branch that changes what the console looks like is not
// pushed, and its pull request is not opened or updated, without screenshots of
// it. The pictures are taken with `pnpm screens`; this only checks that they
// are of the code as it is now.
//
// It gates those moments and nothing else: a Bash call that
// runs `git push` or `gh pr create`/`gh pr edit` (however it is spelled; the
// command is read with `git-guard.mjs`'s parser), and the GitHub MCP tools
// that create or update a pull request. It checks the checkout each of those
// publishes from, which is not always the session's (`cd ../other && git
// push`, `git -C`, a pull request whose head another worktree has). A turn
// that ends, asks the user something or is still mid-change is never held.
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
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ghInvocation, gitInvocation, located, moveTo } from './git-guard.mjs';
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

const PUSH = 'pushes the branch';
const PULL_REQUEST = 'opens or updates a pull request';

/** What a parsed command publishes, or null. */
function publishing(words) {
  if (gitInvocation(words)?.subcommand === 'push') return PUSH;
  const gh = ghInvocation(words);
  if (gh?.group === 'pr' && ['create', 'edit'].includes(gh.action)) return PULL_REQUEST;
  return null;
}

/**
 * The checkout a git or gh command acts on: the directory the line has `cd`d
 * to, then git's `-C`s. Null when the line does not spell it out.
 */
function checkoutOf(words, directory) {
  let where = directory;
  for (const dir of gitInvocation(words)?.directories ?? []) where = moveTo(where, dir);
  return where;
}

/** The checkout with `branch` checked out, among the worktrees of the repository at `cwd`. */
function worktreeOf(cwd, branch) {
  let list;
  try {
    list = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
  let path = null;
  for (const line of list.split('\n')) {
    if (line.startsWith('worktree ')) path = line.slice('worktree '.length);
    else if (line === `branch refs/heads/${branch}`) return path;
  }
  return null;
}

/**
 * What the tool call publishes, each with the checkout it publishes from
 * (`directory`); empty when it publishes nothing this guard covers.
 *
 * - Bash: every `git push` and `gh pr create`/`edit` in the line, in the
 *   directory `cd` and `-C` take it to (`located` in `git-guard.mjs`).
 * - The GitHub MCP tools: the worktree that has the pull request's `head`
 *   checked out; `update_pull_request` names no branch, so the session's.
 *
 * Where the line or the tool does not say (`cd "$DIR"`, a branch no worktree
 * has), `directory` is the session's `cwd`. Failing closed there would refuse
 * ordinary pushes whose directory a hook cannot read, and the session's
 * checkout is almost always the one being published.
 */
export function publishes(toolName, toolInput, cwd = process.cwd()) {
  if (PULL_REQUEST_TOOL.test(toolName ?? '')) {
    const head = typeof toolInput?.head === 'string' ? toolInput.head.split(':').at(-1) : null;
    return [{ action: PULL_REQUEST, directory: (head && worktreeOf(cwd, head)) || cwd }];
  }
  if (toolName !== 'Bash' || typeof toolInput?.command !== 'string') return [];
  return located(toolInput.command, cwd)
    .map(({ words, directory }) => ({
      action: publishing(words),
      directory: checkoutOf(words, directory) ?? cwd,
    }))
    .filter((target) => target.action);
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

/**
 * A publishing guard's PreToolUse entry point: reads the hook's input, and
 * for each checkout the call publishes from (`publishes`) asks
 * `verdict(root)` why it may not be published; the first answer refuses the
 * call. `off` names the variable that stands the guard down. A checkout with
 * no main to compare against (a shallow clone), or none at all, passes.
 * This guard and the verification guard (`verify-guard.mjs`) are each a
 * verdict on it.
 */
export function runGuard(verdict, off) {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {}
  const cwd = input.cwd ?? process.cwd();
  const targets = publishes(input.tool_name, input.tool_input, cwd);
  if (targets.length === 0 || process.env[off] === 'off') return;
  for (const { action, directory } of targets) {
    const root = checkoutRoot(directory);
    if (!root) continue;
    let text = null;
    try {
      text = verdict(root);
    } catch {}
    if (!text) continue;
    const output = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `This call ${action} from ${root}. ${text}`,
      },
    };
    process.stdout.write(`${JSON.stringify(output)}\n`);
    return;
  }
}

/** The top of the checkout at `directory`, or null when it is none (the command itself will fail). */
function checkoutRoot(directory) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: directory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  runGuard((root) => verdict(root), 'OPPENHEIMER_SCREENSHOT_GUARD');
