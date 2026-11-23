/**
 * Z.ai's ZCode (`zai-org/ZCode`, Apache 2.0), whose terminal binary is
 * `zcode`. Everything below is read off the CLI's source at 4.0.0 (CLI
 * 0.18.0): `apps/zcode-cli/packages/cli/src/arguments.ts` and `run.ts`, and
 * its usage guide (`docs/usage/02-cli-reference.md`, `05-permissions.md`,
 * `06-sessions.md`). Not yet watched in a live session.
 */
import type { CodingAgentDefinition } from './catalog.js';
import { TYPED_INPUT } from './typed-input.js';

export const ZCODE_AGENT: CodingAgentDefinition = Object.freeze({
  id: 'zcode',
  label: 'ZCode',
  // Bare `zcode` is the TUI: `run.ts` routes no positional to `tui`.
  command: 'zcode',
  // TYPED_INPUT, and Ctrl+U first: ZCode's TUI empties its draft on it
  // (`app-keyboard.ts`), where Ctrl+C would count towards quitting.
  // 100 ms: it empties the draft on its next render.
  input: Object.freeze({ ...TYPED_INPUT, clear: Object.freeze({ keys: '\u0015', settleMs: 100 }) }),
  // No `transcriptLocation`. ZCode keeps its sessions in one SQLite database
  // (`~/.zcode/cli/db/db.sqlite`), not a file per conversation, and its guide
  // warns against depending on the schema. No `configDirEnv`: nothing the
  // guide names moves the login without also moving the sessions.
  //
  // No models. ZCode has no `--model` (the guide lists it among the flags it
  // does not take): the model is the person's provider config
  // (`~/.zcode/v2/provider_config.json`) or their GLM Coding Plan sign-in,
  // picked in the TUI.
  models: Object.freeze([]),
  launch: Object.freeze({
    // No `conversation`. `--continue` exits with "No resumable session
    // found" before the TUI starts when ZCode saved nothing in the folder
    // (`resume.ts`), which a session restarted before its first message
    // would hit, and `--resume <id>` takes an id the runner cannot learn from
    // the TUI. A restart opens a fresh ZCode; the earlier conversation stays
    // in ZCode's own session list.
    //
    // `--mode build|edit|plan|yolo|guarded`, which the TUI takes as well as
    // `--prompt` does. `build` asks before writes and side effects, `edit`
    // lets workspace edits through and asks for the rest, `yolo` asks for
    // nothing ordinary. `guarded` still asks before dangerous commands, so it
    // is not Full access.
    permission: Object.freeze({
      ask: Object.freeze({ argv: Object.freeze(['--mode', 'build']), env: Object.freeze({}) }),
      auto: Object.freeze({ argv: Object.freeze(['--mode', 'edit']), env: Object.freeze({}) }),
      full: Object.freeze({ argv: Object.freeze(['--mode', 'yolo']), env: Object.freeze({}) }),
    }),
    // No `prompt`. The TUI takes no first task on the command line (a
    // positional is a subcommand, and `--prompt` is the headless turn that
    // answers and exits), so the person types the first one.
  }),
});
