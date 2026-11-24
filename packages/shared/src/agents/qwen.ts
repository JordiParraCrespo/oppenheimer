/**
 * Qwen Code, Alibaba's terminal coding agent: its models and its catalog
 * entry, which `CODING_AGENTS` composes. Read off `@qwen-code/qwen-code`
 * 0.28.4: its `qwen --help`, the argument parser and TUI in the package's
 * bundle (`chunks/*.js`, minified, so cited by identifier or string), and the
 * TUI itself watched in tmux against a scripted OpenAI-compatible server.
 */
import type { CodingAgentDefinition } from './catalog.js';
import { TYPED_INPUT } from './typed-input.js';

export const QWEN_AGENT: CodingAgentDefinition = Object.freeze({
  id: 'qwen',
  label: 'Qwen Code',
  // The package's `bin`: `qwen` → `cli-entry.js`, which wants Node 22.
  command: 'qwen',
  input: Object.freeze({
    ...TYPED_INPUT,
    // Qwen's prompt can hold text nobody typed for this message, two ways,
    // both watched: an Up arrow into an empty prompt recalls the last prompt
    // with the cursor at its start, and Esc mid-turn cancels the turn and
    // puts its message back, with the cursor at its end. Ctrl+K kills to the
    // end of the line and Ctrl+U to its start, each joining a line to the
    // next or the one before at its edge, so pairs of them empty a prompt of
    // any shape and do nothing to an empty one; 16 pairs emptied a recalled
    // three-line prompt in one write. Not Ctrl+C, which counts towards
    // quitting on an empty prompt, and not Esc Esc, which opens "Rewind
    // Conversation" on one. Qwen applies each key to its buffer as it reads
    // it, not on its next render: a message in the same write as the clear
    // was stored whole, three times out of three, so the settle is a margin,
    // not a measured need.
    clear: Object.freeze({ keys: '\u000b\u0015'.repeat(16), settleMs: 50 }),
  }),
  // No `loginTargets` yet. The subscription's sign-in shows
  // `https://chat.qwen.ai/authorize?user_code=…` (watched; `webOrigin` of
  // `getQwenOAuthConfig`, whose `auth.qwen.ai` is the API's base and is
  // never shown), but a new host changes the released link's `loginUrl`
  // pattern, which waits for a protocol release, as Muse's does; until then
  // the URL stays in the terminal, unbuttoned.
  //
  // `$QWEN_HOME/projects/<cwd, every character outside [A-Za-z0-9] a dash>/
  // chats/<session id>.jsonl` (`Storage.getGlobalQwenDir`, `sanitizeCwd`,
  // `SessionService`), written from the first message on, not at launch.
  transcriptLocation: Object.freeze({ directory: '~/.qwen/projects/', keyedBy: 'session-id' }),
  // `QWEN_HOME` moves settings, the login (`oauth_creds.json`) and the
  // conversations together, as `GROK_HOME` does.
  configDirEnv: 'QWEN_HOME',
  // A seed: which ids exist is the provider's the person connected in
  // `/auth`. These are QwenCloud's Qwen models (`QWENCLOUD_MODELS`), in its
  // order, whose first is the subscription's model too
  // (`QWEN_SUBSCRIPTION_MODEL`), and `qwen3.7-max`, an earlier generation
  // Token Plan still lists (`TOKEN_PLAN_MODELS`), behind "More models". Labels are
  // OpenCode's for the ids it lists as well (`opencode-models.ts`). No row
  // carries effort: Qwen takes it only as a setting (below).
  models: Object.freeze([
    Object.freeze({ id: 'qwen3.8-max', label: 'Qwen3.8 Max', default: true as const }),
    Object.freeze({ id: 'qwen4-max', label: 'Qwen4 Max' }),
    Object.freeze({ id: 'qwen3.7-plus', label: 'Qwen3.7 Plus' }),
    Object.freeze({ id: 'qwen3.8-flash', label: 'Qwen3.8 Flash' }),
    Object.freeze({ id: 'qwen3.7-max', label: 'Qwen3.7 Max', legacy: true as const }),
  ]),
  launch: Object.freeze({
    model: Object.freeze(['--model', '<model>']),
    // `--session-id <uuid>` names a new conversation and refuses one that
    // exists ("Session Id … already exists"). The restart is `--continue`,
    // the newest conversation of this folder, not `--resume <id>`: Qwen
    // writes `<id>.jsonl` only once something is said, and until then
    // `--resume <id>` prints "No saved session found with ID …" and exits 1
    // (watched), so a session restarted before its first message would come
    // back with no agent. `--continue` with nothing saved opens a fresh TUI
    // (watched), under an id of Qwen's choosing, which the chat follows in a
    // worktree session (`transcript/qwen.go`). In a folder another Qwen
    // shares, "the newest" may be the other's; a reopen by id once the file
    // exists is a runner change still to make.
    conversation: Object.freeze({
      create: Object.freeze(['--session-id', '<conversation>']),
      resume: Object.freeze(['--continue']),
    }),
    // `--approval-mode plan|default|auto-edit|auto|yolo`. Ask is `default`
    // ("Require approval for file edits or shell commands"), sent although
    // Qwen's own default is `auto`. Approve for me is `auto`, its LLM
    // classifier ("safe actions auto-approve, risky ones are blocked");
    // `auto-edit` would still ask at every command. Full access is `yolo`,
    // through the same flag: `--yolo` with `--approval-mode` is refused.
    // With `security.folderTrust.enabled` on (off by default), an untrusted
    // folder drops `auto` and `yolo` to `default`.
    permission: Object.freeze({
      ask: Object.freeze({
        argv: Object.freeze(['--approval-mode', 'default']),
        env: Object.freeze({}),
      }),
      auto: Object.freeze({
        argv: Object.freeze(['--approval-mode', 'auto']),
        env: Object.freeze({}),
      }),
      full: Object.freeze({
        argv: Object.freeze(['--approval-mode', 'yolo']),
        env: Object.freeze({}),
      }),
    }),
    // No `effort`: no flag and no variable carries it, only the
    // `model.reasoningEffort` setting and the TUI.
    //
    // The first task as `--prompt-interactive=<task>`, one word. A positional
    // is one-shot ("Defaults to one-shot; use -i/--prompt-interactive for
    // interactive"), and the flag's value as a word of its own is read as a
    // flag when it starts with `-`: `--prompt-interactive "-v"` printed the
    // version and exited, where the `=` form opened the TUI on `-v …`
    // (watched).
    prompt: Object.freeze(['--prompt-interactive=<prompt>']),
  }),
});
