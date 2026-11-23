/**
 * Hermes, Nous Research's agent (github.com/NousResearch/hermes-agent), whose
 * binary is `hermes`: its catalog entry, which `CODING_AGENTS` composes. Kept
 * beside the catalog rather than in it because it is the one agent whose model
 * is its own configuration rather than a list the picker offers.
 *
 * Everything below is read off the CLI reference and the configuration and
 * security guides of its documentation site (`website/docs/` in the
 * repository), not yet watched in a live session.
 */
import type { CodingAgentDefinition } from './catalog.js';
import { TYPED_INPUT } from './typed-input.js';

export const HERMES_AGENT: CodingAgentDefinition = Object.freeze({
  id: 'hermes',
  label: 'Hermes',
  command: 'hermes',
  input: TYPED_INPUT,
  // `hermes auth add openai-codex --type oauth` signs in to a ChatGPT
  // subscription through OpenAI's own OAuth. The Nous Portal's sign-in
  // (`hermes setup --portal`) is left off until a session shows which URL it
  // prints: a host added here widens the link's `loginUrl` pattern, which a
  // control plane older than the runner would refuse.
  loginTargets: Object.freeze([Object.freeze({ host: 'auth.openai.com' })]),
  // One SQLite database for every session, `$HERMES_HOME/state.db`, keyed by
  // Hermes' own session id, as OpenCode's is.
  transcriptLocation: Object.freeze({
    directory: '~/.hermes/',
    keyedBy: 'session-id',
  }),
  // `HERMES_HOME` (default `~/.hermes`) holds `config.yaml`, the `.env` of API
  // keys and `auth.json`, as `CLAUDE_CONFIG_DIR` holds Claude Code's.
  configDirEnv: 'HERMES_HOME',
  // None. Hermes reaches some forty providers, each with its own model names
  // (`hermes chat --provider`), and the person picks theirs once with `hermes
  // model`, so a seed here would be ids that work on one provider and fail on
  // the rest. The picker offers Hermes outright, it runs the model it is
  // configured with, and `/model` switches inside the session. With no model
  // there is no effort either: Hermes has no flag for one
  // (`agent.reasoning_effort` in its config, `/reasoning` in a session).
  models: Object.freeze([]),
  launch: Object.freeze({
    // `hermes chat`, not bare `hermes`: the subcommand is the one that takes
    // a first task (`--query`), and both open the same interactive session.
    always: Object.freeze(['chat']),
    model: Object.freeze(['--model', '<model>']),
    // `--continue` resumes "the most recent session", scoped to the working
    // directory's workspace (the CLI reference, beside `--resume latest`), and
    // a session's worktree is its own and never reused, so it reopens this
    // session's conversation and nobody else's. Hermes names its own session,
    // and no flag sets one up front, so there is nothing to pin on a create.
    conversation: Object.freeze({ resume: Object.freeze(['--continue']) }),
    // No `permission`. Hermes asks only before a command its patterns flag
    // as dangerous, never before an edit, and the only launch flag is
    // `--yolo`; which of `smart` (its default, an auxiliary model screening
    // what is flagged) and `manual` it runs is `approvals.mode` in its own
    // config. That is not the product's three levels, so the console hides
    // the chip and Hermes runs as the person configured it, as pi does.
    //
    // `--query <text>`: "On a real TTY the prompt is submitted literally as
    // the first turn of a normal interactive session … and the session stays
    // open". A session's window 0 is a tmux pane, a real TTY. `--oneshot` and
    // `-Q` are the ones that answer and exit.
    prompt: Object.freeze(['--query', '<prompt>']),
  }),
});
