#!/usr/bin/env node
// PreToolUse hook: a branch is not pushed, and its pull request is not opened
// or updated, until what it changes has been checked where it runs. What
// each check covers and what answers it is `verification.mjs`:
//
// - in a cloud session, code that runs in the product is checked on the local
//   stack the SessionStart hook brought up (`scripts/stack/cloud-warmup.sh`);
// - everywhere, an agentic change (what a model is shown or can call: the
//   bots, the agent engines, the prompts) is checked by an eval that passed
//   on it.
//
// It gates the same calls as the screenshot guard (`publishes` there), on the
// checkout each publishes from. A record of why a check does not apply
// (`stack.mjs skip`, `record.mjs --skip`) answers it as well as a run: the
// gate makes the check the default, not a wall. A run that checks nothing by
// design sets `OPPENHEIMER_VERIFY_GUARD=off`. Cases are in
// `.agents/hooks/verify-guard.test.mjs`.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishes } from './screenshot-guard.mjs';
import { owed } from './verification.mjs';

const HOW = {
  stack:
    'Check it on the local stack first (the `local-stack` skill: `node scripts/stack/stack.mjs status`, then the suite its table names, or drive it through the console), then record what you ran and saw with `node scripts/stack/stack.mjs verified "<what you ran and saw>"`. If nothing it changes can be seen running (a type, a log line), record why with `node scripts/stack/stack.mjs skip "<why>"` and say the same in the pull request.',
  evals:
    'It is agentic: run the evals that cover it (`scripts/evals/README.md` maps each to what it covers; a new tool, prompt or rule gets a case of its own first, so the eval fails without the change), e.g. `pnpm eval:bot-skills --runs 1`; a green run records itself. If no eval can see the change (a rename, a mapper), record why with `node scripts/evals/record.mjs --skip "<why>"` and say the same in the pull request.',
};

/** The message that refuses publishing the checkout at `root`, or null. */
export function verdict(root, options) {
  // A checkout pruned of the stack or the evals has nothing to ask for.
  if (!existsSync(join(root, 'scripts/stack/stack.mjs'))) return null;
  const missing = owed(root, options);
  if (missing.length === 0) return null;
  return missing.map(({ name, text }) => `${text} ${HOW[name]}`).join(' ');
}

function rootOf(directory) {
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

function main() {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {}
  const cwd = input.cwd ?? process.cwd();
  const targets = publishes(input.tool_name, input.tool_input, cwd);
  if (targets.length === 0 || process.env.OPPENHEIMER_VERIFY_GUARD === 'off') return;
  for (const { action, directory } of targets) {
    const root = rootOf(directory);
    if (!root) continue;
    let text = null;
    try {
      text = verdict(root);
    } catch {
      // No main to compare against (a shallow clone): nothing to check.
    }
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

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
