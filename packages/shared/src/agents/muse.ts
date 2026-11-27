/**
 * Muse Code, Meta's terminal coding agent: its models and its catalog entry,
 * which `CODING_AGENTS` composes. Everything below is read off Meta's own
 * documentation (`dev.meta.ai/docs/muse-code/`: configuration, permissions,
 * interactive, auth) and the launcher its `install.sh` installs
 * (`api.meta.ai/muse-launcher.sh`). A launch option those pages do not
 * document is left out rather than guessed.
 */
import type { CodingAgentDefinition } from './catalog.js';
import { levels } from './effort-levels.js';
import { TYPED_INPUT } from './typed-input.js';

/**
 * The levels `muse --reasoning-effort` takes, less `none`, which "the Meta
 * provider does not accept". `high` is the CLI's default. The docs give the
 * one list for the CLI and no per-model menu, so every model offers all of
 * it: a level a model refuses fails in the session's own terminal.
 */
const MUSE_LEVELS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'] as const;

export const MUSE_AGENT: CodingAgentDefinition = Object.freeze({
  id: 'muse',
  label: 'Muse',
  // Installed by `dev.meta.ai/install.sh` as `~/.local/bin/muse`, a launcher
  // that keeps the native binary beside it current on its own.
  command: 'muse',
  input: TYPED_INPUT,
  // No `loginTargets` yet. "Sign in with your browser" is an OAuth device
  // flow against `auth.meta.com` (the launcher's `auth_url`), but a new host
  // changes the released link's `loginUrl` pattern, which waits for a
  // protocol release; until then the URL stays in the terminal, unbuttoned.
  //
  // No `transcriptLocation`: Muse "records every run as an append-only event
  // log", but no page says where on disk.
  //
  // No `configDirEnv`: settings live in `~/.config/muse/` and the login in
  // its `auth.json`, which `MUSE_AUTH_PATH` moves as a file; no variable
  // moves the directory and nothing else.
  //
  // The models on Meta's pricing page, newest first; `muse-spark-1.2` is the
  // default ("The default model is `muse-spark-1.2`"). The `-contributor`
  // variants of each, whose runs Meta uses to improve its products, are left
  // to the person to pick in Muse itself.
  models: Object.freeze([
    Object.freeze({
      id: 'muse-spark-1.3',
      label: 'Muse Spark 1.3',
      effort: levels(MUSE_LEVELS, 'high'),
    }),
    Object.freeze({
      id: 'muse-spark-1.2',
      label: 'Muse Spark 1.2',
      default: true as const,
      effort: levels(MUSE_LEVELS, 'high'),
    }),
    Object.freeze({
      id: 'muse-ember-1.0',
      label: 'Muse Ember 1.0',
      effort: levels(MUSE_LEVELS, 'high'),
    }),
  ]),
  launch: Object.freeze({
    model: Object.freeze(['--model', '<model>']),
    // No `conversation`. Muse reopens "the most recent session in this
    // workspace" with `/resume --last`, typed in the TUI; the docs give no
    // launch flag for it, so a restarted session opens a fresh Muse.
    //
    // `--approval-mode on-request|untrusted|never`. `on-request`, Muse's
    // default, lets "recognized, non-dangerous" commands through and asks
    // for the rest, which is Auto; `untrusted` is "stricter". Full
    // access is `--yolo`, which turns off the approvals *and* the sandbox, as
    // Codex's Full access does; `never` alone would keep the sandbox.
    permission: Object.freeze({
      ask: Object.freeze({
        argv: Object.freeze(['--approval-mode', 'untrusted']),
        env: Object.freeze({}),
      }),
      auto: Object.freeze({
        argv: Object.freeze(['--approval-mode', 'on-request']),
        env: Object.freeze({}),
      }),
      full: Object.freeze({ argv: Object.freeze(['--yolo']), env: Object.freeze({}) }),
    }),
    effort: Object.freeze({
      argv: Object.freeze(['--reasoning-effort', '<effort>']),
      env: Object.freeze({}),
    }),
    // No `prompt`: the docs start the TUI as plain `muse` and take a task
    // on the command line only in `muse exec`, which answers and exits. The
    // person types the first task, as in a blank terminal.
  }),
});
