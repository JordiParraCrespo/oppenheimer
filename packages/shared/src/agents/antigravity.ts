/**
 * Google's Antigravity CLI, whose binary is `agy`: the catalog entry, apart
 * from `catalog.ts` as the Pi family is, which that record composes.
 *
 * Everything below is read off Google's CLI reference and models pages
 * (`antigravity.google/docs/cli/reference`, `…/docs/models`) and the strings
 * of agy 1.5.15's own binary, and is not yet watched in a live session.
 */

import type { CodingAgentDefinition } from './catalog.js';
import { GEMINI_4_LEVELS, GEMINI_FLASH_LEVELS, levels } from './effort-levels.js';
import { TYPED_INPUT } from './typed-input.js';

export const ANTIGRAVITY_AGENT: CodingAgentDefinition = Object.freeze({
  id: 'antigravity',
  label: 'Antigravity',
  command: 'agy',
  input: TYPED_INPUT,
  // No `loginTargets` yet. A personal account signs in with Google OAuth,
  // through an `accounts.google.com/o/oauth2/…` URL agy opens or, on a host
  // with no browser, prints; but a new host widens the link's `loginUrl`
  // pattern, which the released protocol counts as a break. Until a
  // protocol release carries it, the person signs in in the terminal.
  // No `transcriptLocation`: Google documents none, so the session is a
  // terminal with no chat view. No `configDirEnv`
  // either: the login is in the OS keyring, not a directory a variable moves.
  //
  // The models `agy --model` takes, by the ids agy 1.5.15 carries. Gemini 4
  // Neon is the default "for new conversations if you haven't chosen a
  // model". The thinking level is `--effort`, never folded into the id
  // (`gemini-4-neon-xhigh`), since agy refuses an id that carries one
  // beside an `--effort` that differs. The Claude rows are Antigravity's own
  // "(Thinking)" models, which take no level of ours.
  models: Object.freeze([
    Object.freeze({
      id: 'gemini-4-neon',
      label: 'Gemini 4 Neon',
      default: true as const,
      effort: levels(GEMINI_4_LEVELS, 'medium'),
    }),
    Object.freeze({
      id: 'gemini-4-carbon',
      label: 'Gemini 4 Carbon',
      effort: levels(GEMINI_4_LEVELS, 'medium'),
    }),
    Object.freeze({
      id: 'gemini-4-argon',
      label: 'Gemini 4 Argon',
      effort: levels(GEMINI_4_LEVELS, 'medium'),
    }),
    Object.freeze({
      id: 'gemini-4-hydrogen',
      label: 'Gemini 4 Hydrogen',
      effort: levels(GEMINI_4_LEVELS, 'medium'),
    }),
    Object.freeze({
      id: 'gemini-3.8-flash',
      label: 'Gemini 3.8 Flash',
      effort: levels(GEMINI_FLASH_LEVELS, 'medium'),
    }),
    Object.freeze({ id: 'claude-opus-5-5', label: 'Claude Opus 5.5' }),
    Object.freeze({ id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' }),
  ]),
  launch: Object.freeze({
    model: Object.freeze(['--model', '<model>']),
    // `--conversation <id>` reopens an id agy chose and none can be named at
    // create, so like Pi's the conversation is reopened with `--continue`,
    // "the most recent conversation" in the working directory, which is the
    // session's own worktree.
    conversation: Object.freeze({ resume: Object.freeze(['--continue']) }),
    // `--mode`: `default` asks before edits and commands, `accept-edits`
    // "auto-approve[s] file edits, prompt[s] for commands", as Claude Code's
    // `acceptEdits` does. Ask is sent rather than left out because agy 1.5.7
    // and later start in `auto` where the account has it. Full access is
    // `--dangerously-skip-permissions`, which approves every tool.
    permission: Object.freeze({
      ask: Object.freeze({
        argv: Object.freeze(['--mode', 'default']),
        env: Object.freeze({}),
      }),
      auto: Object.freeze({
        argv: Object.freeze(['--mode', 'accept-edits']),
        env: Object.freeze({}),
      }),
      full: Object.freeze({
        argv: Object.freeze(['--dangerously-skip-permissions']),
        env: Object.freeze({}),
      }),
    }),
    effort: Object.freeze({
      argv: Object.freeze(['--effort', '<effort>']),
      env: Object.freeze({}),
    }),
    // `-i`/`--prompt-interactive`: run the prompt, then stay in the session.
    // agy takes no positional prompt ("Prompts are read only from -p/--print,
    // -i/--prompt-interactive, or stdin"), and `-p` answers and exits.
    prompt: Object.freeze(['--prompt-interactive', '<prompt>']),
  }),
});
