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
    // Qwen's prompt can hold text nobody typed for this message, three ways,
    // all watched: an Up arrow into an empty prompt recalls the last prompt
    // with the cursor at its start, Esc mid-turn cancels the turn and puts
    // its message back, with the cursor at its end, and a rewind puts the
    // turn it went back to there for editing. Each round is Ctrl+E (the end
    // of the visual line), Meta+D (the word after it, the line break at a
    // line's end) and Ctrl+U (the line up to the cursor, or the break before
    // it at its start), so lines below the cursor are folded in and the rest
    // killed from the end; 32 rounds emptied each of those, a three-line
    // paste and a recalled 2,000-character prompt wrapped over eighteen rows,
    // and do nothing to an empty prompt. A message in the same write as the
    // clear was stored whole every time: Qwen applies each key to its buffer
    // as it reads it, not on its next render, so the settle is a margin.
    //
    // The keys must also be inert in the dialogs a prompt can sit under. In
    // Rewind, the list's Up is `up`, `k` or Ctrl+P and its restore options
    // match `up` or `k` whatever the modifiers (`RewindSelector`), so Ctrl+K,
    // the obvious kill to the end, walked the options up to "Restore code and
    // conversation" (watched); Ctrl+E, Meta+D and Ctrl+U left both steps as
    // they were (watched). Not Ctrl+N either, which moves a list's selection
    // down and, past the prompt's end, hands focus to a background agent's
    // panel; not Ctrl+D or Ctrl+C, which count towards quitting on an empty
    // prompt; not Ctrl+F, which moves into a running shell; and not Esc Esc,
    // which opens Rewind. Meta+D is `ESC d`, which Qwen's readline
    // (`escapeCodeTimeout: 0`) reads as one key when both bytes arrive in one
    // read, as a single write delivers them.
    clear: Object.freeze({ keys: '\u0005\u001bd\u0015'.repeat(32), settleMs: 50 }),
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
