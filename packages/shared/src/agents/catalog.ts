/**
 * The coding agents this product can launch.
 *
 * A closed union and a frozen config record, deliberately **not a table**:
 * every entry carries behaviour the runner needs code for anyway (how to
 * launch it, where it writes its transcript, which variable scopes its
 * login), so a row would be a second source of truth that could drift from
 * the code that acts on it. `product/versions/mvp/10-api-modules-and-data-model.md`
 * argues this under "The two 'not a table' decisions".
 *
 * Whether *this machine* actually has the agent on PATH is the other half and
 * is a host fact (`host.capabilities`), reported by the runner and shown as a
 * hint on the agent chip — never a gate.
 *
 * This module is data. Its functions are the type guard, because a closed
 * union needs one at every boundary a string arrives at, and the two effort
 * lookups (`effortFor`, `effortLevelFor`), because which levels a session
 * offers depends on its model as well as its agent, and every tier has to ask
 * that the same way.
 */

/**
 * Every agent id, in display order.
 *
 * `shell` is the plain terminal: no agent at all, window 0 is the host's own
 * login shell in the worktree. It lives here rather than beside the list
 * because the console picks it from the same engine button and the runner
 * reads the same id off `session.create`.
 */
export const CODING_AGENT_IDS = ['claude-code', 'codex', 'opencode', 'grok', 'shell'] as const;

export type CodingAgentId = (typeof CODING_AGENT_IDS)[number];

/** Where an agent keeps the conversation transcript, and what it keys it by. */
export interface CodingAgentTranscriptLocation {
  /** Directory the CLI writes transcripts into, `~`-relative as the CLI documents it. */
  readonly directory: string;
  /**
   * What names a transcript inside that directory. Claude Code keys by the
   * working directory, which is why a session's directory name is never
   * reused: a new session landing on a retired name would inherit a
   * stranger's history.
   */
  readonly keyedBy: 'working-directory' | 'session-id';
}

/**
 * What the agent may do on the host without asking, in the product's own three
 * words rather than any one CLI's.
 *
 * The console draws these three and only these (`product/versions/mvp/05-screens.md`):
 * a hand for "Ask for approval", a shield for "Approve for me", an alert ring
 * for "Full access" — the last in a warning tone, because it is the one that
 * changes a machine unattended.
 */
export const SESSION_PERMISSIONS = ['ask', 'auto', 'full'] as const;

export type SessionPermission = (typeof SESSION_PERMISSIONS)[number];

/**
 * Every effort level name any CLI here takes: the wire's and the columns'
 * vocabulary, and **not a scale**. Which names a launch may carry, and in what
 * order they run from faster to smarter, is each model's own list
 * (`CodingAgentModel.effort`); a name the session's model does not list is
 * recorded as none and never sent (`effortLevelFor`).
 *
 * The names are the CLIs' own, so a recorded level is the level the CLI was
 * started at. `none` is thinking switched off, which only a model that does
 * not think unasked offers (Haiku under OpenCode); `ultra` is Codex's level
 * above `max`, which also lets the agent hand work to sub-agents.
 */
export const SESSION_EFFORTS = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
  'ultra',
] as const;

export type SessionEffort = (typeof SESSION_EFFORTS)[number];

/**
 * The effort levels one model offers, from faster to smarter, and the one its
 * CLI runs when nobody asks — where the slider's knob starts. How a level is
 * spelled on the command line is the agent's (`CodingAgentLaunch.effort`).
 */
export interface CodingAgentEffort {
  readonly levels: readonly SessionEffort[];
  readonly default: SessionEffort;
}

/**
 * How one agent is told an effort level: the argv and environment a level
 * becomes, with `<effort>` replaced by the level's name and `<model>` by the
 * model's id **inside** each word, since no CLI here takes the level as a word
 * of its own (`model_reasoning_effort=<effort>`, OpenCode's JSON). Both are
 * safe to splice: a level is a name from `SESSION_EFFORTS`, and a level is only
 * spelled for a model the catalog lists with it, whose id is catalog data.
 *
 * `unset` is the level that is the CLI left alone, which sends nothing.
 *
 * The environment names never meet a permission level's: the spec holds that,
 * and the runner lets the permission level win if they ever did.
 */
export interface CodingAgentEffortSpelling extends CodingAgentLaunchLevel {
  readonly unset?: SessionEffort;
}

/** One model the engine button offers, inside its agent's pane. */
export interface CodingAgentModel {
  /** Passed to the agent verbatim, so it is a name that CLI's `--model` takes. */
  readonly id: string;
  /** What the button and the row read ("Claude Opus 5.5"). */
  readonly label: string;
  /** Offered first, and what a session with no model chosen runs. */
  readonly default?: true;
  /**
   * The effort levels this model's CLI offers for it. Per model because that is
   * where the CLIs put them: Codex's Luna stops at `max` where Sol goes on to
   * `ultra`, Claude Code starts Opus at `medium` and Fable at `high`, and
   * Haiku takes no effort at all under Claude Code.
   *
   * Absent: this model has no notion of effort, and the console hides the
   * slider.
   */
  readonly effort?: CodingAgentEffort;
}

/**
 * One permission level as the host starts the agent with it: the argv appended
 * to `command`, and the environment set on that process alone.
 *
 * Both halves are one object because together they *are* the level. A CLI
 * whose approvals are a flag (Claude Code, Codex) has an empty `env`; one whose
 * approvals are configuration (OpenCode's `OPENCODE_PERMISSION`) states them
 * there. The runner emits the two together or not at all — the env as an
 * `env NAME=value` prefix on window 0's command line, so a shell tab opened
 * beside the agent does not inherit it — and there is no path that rebuilds
 * one half without the other.
 */
export interface CodingAgentLaunchLevel {
  readonly argv: readonly string[];
  readonly env: Readonly<Record<string, string>>;
}

/**
 * How one agent is told what the person chose: argv, not prose.
 *
 * Every argv is the **argument vector** to append to `command`, so the runner
 * concatenates rather than parses, and a value that would need quoting cannot
 * become a second word by accident. `<model>` and `<prompt>` are the
 * placeholders, each substituted whole.
 *
 * Effort's spelling is here, once per agent; which levels a model offers is
 * its own row's.
 */
export interface CodingAgentLaunch {
  /** Absent: this agent takes no model. */
  /**
   * Flags every launch of this agent carries, before anything a caller chose.
   * They are how the session is run rather than what it is asked to do, so
   * they are not a level and nothing in the console offers them.
   */
  readonly always?: readonly string[];
  readonly model?: readonly string[];
  /**
   * How the agent's own conversation is named and reopened, with
   * `<conversation>` substituted whole.
   *
   * These CLIs already keep the transcript — `transcriptLocation` is where —
   * so a session that ends does not lose what was said; what was missing is a
   * name both sides agree on. `create` pins the agent's conversation to the
   * session's own id, and `resume` reopens that conversation in the same
   * worktree, so a stopped session is continued rather than read back.
   *
   * `create` absent, `resume` present: the CLI cannot be told an id but can
   * reopen one it chose (Codex, OpenCode), so the id is discovered from the
   * transcript rather than assigned.
   *
   * Both absent: this agent has no conversation to resume (a plain shell).
   */
  readonly conversation?: {
    readonly create?: readonly string[];
    readonly resume: readonly string[];
    /**
     * The resume form is a subcommand, so it leads the argv instead of
     * following it: `codex resume --last --model …`, never `codex --model …
     * resume --last`.
     */
    readonly resumeLeads?: boolean;
  };
  /**
   * Absent: this agent has no notion of approvals (a plain shell). The console
   * hides the permission chip and sends no level, and the session records none.
   */
  readonly permission?: Readonly<Record<SessionPermission, CodingAgentLaunchLevel>>;
  /** Absent: no model of this agent takes an effort. */
  readonly effort?: CodingAgentEffortSpelling;
  /**
   * How the person's first task reaches the agent, with `<prompt>` substituted
   * whole — always the **last** argv appended: Claude Code, Codex and Grok take
   * it as a trailing positional, OpenCode as the value of its trailing `--prompt`.
   *
   * A launch option, never a message typed at the running TUI: these CLIs do
   * not take a first task that way, and "the TUI is up" has no moment to race
   * against (`product/versions/mvp/02-runner.md` §5). In argv the task is
   * present before the agent starts, with nothing to synchronise.
   *
   * Absent: this agent takes no task on the command line, and the person types
   * the first one themselves.
   */
  readonly prompt?: readonly string[];
}

/**
 * A vendor login the console may turn into a button: a host, compared for
 * equality, and optionally a path the URL's path must start with.
 *
 * Hosts are hosts and not regex, because F3 is host equality: `claude.ai` and
 * `claude.ai.attacker.test` differ by a suffix (`product/04-security-review.md`).
 * GitHub is a login host only at `/login/device`, which is what `path` says.
 */
export interface CodingAgentLoginTarget {
  readonly host: string;
  readonly path?: string;
}

export interface CodingAgentDefinition {
  readonly id: CodingAgentId;
  readonly label: string;
  /**
   * The executable the runner launches inside the session's tmux window.
   * Empty for the plain terminal, whose window 0 is the host's login shell.
   */
  readonly command: string;
  /**
   * The vendor logins the CLI prints when it needs an account, so the console
   * can turn one into a button.
   *
   * **This is the only statement of them.** Both enforcements are generated
   * from it: the link's check (`sessionSnapshotSchema.loginUrl` in
   * `../protocol/primitives.ts`, whose pattern survives into the emitted JSON
   * Schema) and the runner's own allowlist (`launch_catalog.gen.go`, which the
   * screen classifier reads per agent). A URL on any other host, or from any
   * other agent's screen, never becomes a button.
   *
   * Absent: nothing this entry prints is a login, and a URL a plain shell shows
   * is never turned into a button.
   */
  readonly loginTargets?: readonly CodingAgentLoginTarget[];
  /**
   * Where the CLI writes the transcript the first prompt is read from.
   * Absent: there is no transcript (a plain shell).
   */
  readonly transcriptLocation?: CodingAgentTranscriptLocation;
  /**
   * The environment variable that scopes the agent's credential to a
   * directory. One login per configuration directory, not one per machine —
   * which is what makes the later accounts slice possible without changing
   * anything global on the host.
   *
   * Absent: there is no login to scope (a plain shell), or no variable yet
   * that moves this agent's credentials and nothing else (OpenCode).
   */
  readonly configDirEnv?: string;
  /**
   * The models the engine button offers for this agent, in display order.
   *
   * Empty is a real answer and not a gap: the console picks such an agent
   * outright and the button names the agent itself, which is what a blank
   * terminal wants. Every agent here carries a **seed** — the models its CLI
   * documents, not ids invented for the picker — and which of them a given
   * machine's CLI actually knows is open question 6 in
   * `product/versions/mvp/05-screens.md`; until it is probed, an unknown id
   * fails in the session's own terminal, where the person can see it.
   */
  readonly models: readonly CodingAgentModel[];
  /** What the person's three choices mean to this CLI. */
  readonly launch: CodingAgentLaunch;
  /**
   * The argv, appended to `command`, that updates this CLI in place to its
   * latest release **without asking**: the runner runs it unattended, with no
   * terminal and nothing on stdin (`product/versions/mvp/02-runner.md` §10).
   *
   * Absent: this CLI has no updater that runs without asking (OpenCode's,
   * or a plain shell's none), and the runner leaves it alone.
   */
  readonly update?: readonly string[];
}

/** A model's levels and default, frozen as the rest of the catalog is. */
function levels(ids: readonly SessionEffort[], defaultLevel: SessionEffort): CodingAgentEffort {
  return Object.freeze({ levels: Object.freeze([...ids]), default: defaultLevel });
}

const CLAUDE_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
const CODEX_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
const CODEX_ULTRA_LEVELS = [...CODEX_LEVELS, 'ultra'] as const;
const GROK_LEVELS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

/**
 * Frozen because it is shared mutable state otherwise: the API and the
 * console both read the same object.
 */
export const CODING_AGENTS: Readonly<Record<CodingAgentId, CodingAgentDefinition>> = Object.freeze({
  'claude-code': Object.freeze({
    id: 'claude-code',
    label: 'Claude Code',
    command: 'claude',
    loginTargets: Object.freeze([
      Object.freeze({ host: 'claude.ai' }),
      Object.freeze({ host: 'console.anthropic.com' }),
    ]),
    transcriptLocation: Object.freeze({
      directory: '~/.claude/projects/',
      keyedBy: 'working-directory',
    }),
    configDirEnv: 'CLAUDE_CONFIG_DIR',
    // The family, one row per model, named as the person choosing it knows it.
    //
    // Pinned ids rather than the aliases `claude --help` also takes (`opus`,
    // `sonnet`, `fable`): a row's label names a generation, and the day an alias
    // moves the button would keep its label while the host runs something else.
    // A pinned id can only go stale in the open.
    //
    // The newest of each line, in the order Claude's own model picker lists
    // them; Opus 5.5, the everyday model of the four, is the default.
    // Each effort default is what claude runs the model at unasked; Haiku has
    // none, since `--effort` changes nothing claude sends for it.
    models: Object.freeze([
      Object.freeze({
        id: 'claude-opus-5-5',
        label: 'Claude Opus 5.5',
        default: true as const,
        effort: levels(CLAUDE_LEVELS, 'medium'),
      }),
      Object.freeze({
        id: 'claude-fable-5-1',
        label: 'Claude Fable 5.1',
        effort: levels(CLAUDE_LEVELS, 'high'),
      }),
      Object.freeze({
        id: 'claude-sonnet-5-5',
        label: 'Claude Sonnet 5.5',
        effort: levels(CLAUDE_LEVELS, 'medium'),
      }),
      Object.freeze({ id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' }),
    ]),
    launch: Object.freeze({
      model: Object.freeze(['--model', '<model>']),
      // `--session-id` takes a UUID and refuses one that already exists, which
      // is exactly the property wanted: the session's own id names the
      // conversation once, and `--resume` reopens it by that name afterwards.
      conversation: Object.freeze({
        create: Object.freeze(['--session-id', '<conversation>']),
        resume: Object.freeze(['--resume', '<conversation>']),
      }),
      permission: Object.freeze({
        // `--permission-mode` choices, read off claude 2.1.278's own `--help`.
        ask: Object.freeze({
          argv: Object.freeze(['--permission-mode', 'manual']),
          env: Object.freeze({}),
        }),
        auto: Object.freeze({
          argv: Object.freeze(['--permission-mode', 'acceptEdits']),
          env: Object.freeze({}),
        }),
        full: Object.freeze({
          argv: Object.freeze(['--permission-mode', 'bypassPermissions']),
          env: Object.freeze({}),
        }),
      }),
      // `--effort <level>`, whose `--help` lists low | medium | high | xhigh | max.
      effort: Object.freeze({
        argv: Object.freeze(['--effort', '<effort>']),
        env: Object.freeze({}),
      }),
      // `claude [options] [command] [prompt]`, whose own help calls the
      // positional "Your prompt" and the default mode "an interactive
      // session" — so this starts the TUI with the task already in it.
      prompt: Object.freeze(['<prompt>']),
    }),
    // `claude update|upgrade`: "Check for updates and install if available",
    // claude 2.1.284. It takes no options and asks nothing.
    update: Object.freeze(['update']),
  }),
  codex: Object.freeze({
    id: 'codex',
    label: 'Codex',
    command: 'codex',
    loginTargets: Object.freeze([
      Object.freeze({ host: 'auth.openai.com' }),
      Object.freeze({ host: 'platform.openai.com' }),
      Object.freeze({ host: 'chatgpt.com' }),
    ]),
    transcriptLocation: Object.freeze({
      directory: '~/.codex/sessions/',
      keyedBy: 'session-id',
    }),
    configDirEnv: 'CODEX_HOME',
    // The four OpenAI ships for Codex, in capability order, with the slugs
    // `codex --model` takes. Sol is the default because it is the CLI's own
    // (`model = "gpt-5.6-sol"` in the documented starting `config.toml`), and
    // Astra is not: it wants Codex 0.153.1 and Trusted Access, so defaulting to
    // it would hand most hosts a row their CLI refuses.
    //
    // Same seed argument as Claude Code above, and the same limit: a probe is
    // still what would tell the console which of these *this* machine's codex
    // knows (`product/versions/mvp/05-screens.md`, open question 6).
    //
    // Each model's levels and default are codex's own (`codex debug models`):
    // Sol and Astra think `low` unasked, Terra and Luna `medium`, Luna has no
    // `ultra`, and none has `minimal`. Codex forwards a level a model lacks to
    // the API unchanged, so a level listed here that the model does not take
    // is a failed turn, not a dropped setting.
    models: Object.freeze([
      Object.freeze({
        id: 'gpt-6-astra',
        label: 'GPT-6 Astra',
        effort: levels(CODEX_ULTRA_LEVELS, 'low'),
      }),
      Object.freeze({
        id: 'gpt-5.6-sol',
        label: 'GPT-5.6 Sol',
        default: true as const,
        effort: levels(CODEX_ULTRA_LEVELS, 'low'),
      }),
      Object.freeze({
        id: 'gpt-5.6-terra',
        label: 'GPT-5.6 Terra',
        effort: levels(CODEX_ULTRA_LEVELS, 'medium'),
      }),
      Object.freeze({
        id: 'gpt-5.6-luna',
        label: 'GPT-5.6 Luna',
        effort: levels(CODEX_LEVELS, 'medium'),
      }),
    ]),
    launch: Object.freeze({
      // A session is a terminal nobody is watching, so it cannot depend on
      // the state of a server shared with whatever else the host runs. Codex
      // reuses a background app-server across invocations, and when the one
      // already running is a different release it refuses with a modal — "run
      // without daemon this time", offered to a reader who is not there —
      // which hangs the session for good. Measured on a host with a stale
      // 0.159.0 daemon beside 0.159.2: every codex session stopped on that
      // dialog until a key was pressed. `--no-daemon` answers it up front,
      // and each session is its own process either way.
      always: Object.freeze(['--no-daemon']),
      model: Object.freeze(['--model', '<model>']),
      // Codex names its own conversation, so there is nothing to pin on a
      // create — but it does not need one. `codex resume` filters by working
      // directory (that is what `--all` turns off, read off 0.159.2's own
      // `--help`), and a session's worktree is its own directory that is never
      // reused, so "the most recent conversation here" is this session's and
      // no other's. With nothing to resume it opens a fresh Codex rather than
      // failing, which is what a session whose agent never got going needs.
      conversation: Object.freeze({
        resume: Object.freeze(['resume', '--last']),
        resumeLeads: true,
      }),
      permission: Object.freeze({
        // Read off codex-cli 0.155.1's own `--help`. `--approve-for-me` is that
        // CLI's own name for the middle level, and is more than the flag pair it
        // replaces: it routes approvals through an automatic review.
        ask: Object.freeze({
          argv: Object.freeze(['--ask-for-approval', 'on-request', '--sandbox', 'workspace-write']),
          env: Object.freeze({}),
        }),
        auto: Object.freeze({ argv: Object.freeze(['--approve-for-me']), env: Object.freeze({}) }),
        full: Object.freeze({
          argv: Object.freeze(['--dangerously-bypass-approvals-and-sandbox']),
          env: Object.freeze({}),
        }),
      }),
      // No flag: the `model_reasoning_effort` config key, set per invocation.
      effort: Object.freeze({
        argv: Object.freeze(['-c', 'model_reasoning_effort=<effort>']),
        env: Object.freeze({}),
      }),
      // `codex [OPTIONS] [PROMPT]`, documented as "Optional user prompt to
      // start the session". Not the `exec` subcommand, which is the
      // non-interactive one and would give the person no terminal to take over.
      prompt: Object.freeze(['<prompt>']),
    }),
    // `codex update`: "Update Codex to the latest version", codex-cli 0.158.0.
    // Its options are config overrides only; it asks nothing.
    update: Object.freeze(['update']),
  }),
  opencode: Object.freeze({
    id: 'opencode',
    label: 'OpenCode',
    command: 'opencode',
    // OpenCode is not one vendor: `opencode auth login` signs in to whichever
    // provider is picked, so it prints OpenCode Zen's own login or that
    // provider's — Anthropic's, OpenAI's, or GitHub Copilot's device flow.
    loginTargets: Object.freeze([
      Object.freeze({ host: 'opencode.ai' }),
      Object.freeze({ host: 'claude.ai' }),
      Object.freeze({ host: 'console.anthropic.com' }),
      Object.freeze({ host: 'auth.openai.com' }),
      Object.freeze({ host: 'chatgpt.com' }),
      Object.freeze({ host: 'github.com', path: '/login/device' }),
    ]),
    // One SQLite database for every session, keyed by OpenCode's own session
    // id (`~/.local/share/opencode/opencode.db`, as Orca's session scanner
    // reads it).
    transcriptLocation: Object.freeze({
      directory: '~/.local/share/opencode/',
      keyedBy: 'session-id',
    }),
    // No `configDirEnv`. OpenCode keeps its logins in
    // `$XDG_DATA_HOME/opencode/auth.json`, and `OPENCODE_CONFIG_DIR` moves the
    // config but not the credentials; the only variable that moves them is
    // the machine's whole data home, which would relocate every XDG program in
    // the window along with it. That is not one login per directory, so the
    // accounts slice has nothing to set here until OpenCode has a variable of
    // its own (`product/06-multi-account.md`).
    //
    // `provider/model`, the form `opencode --model` takes. OpenCode reaches
    // whatever providers the host has signed in to, so this seed is the
    // Anthropic family Claude Code offers, under OpenCode's `anthropic/`
    // provider, plus OpenAI's Codex default. A row the host's OpenCode has
    // no provider for fails in the session's own terminal, as for the others.
    //
    // Each model's levels are its OpenCode variants (`opencode models
    // --verbose`), and its default is what it runs with none: the API's own
    // `high` for the adaptive Claude models, no thinking for Haiku, whose
    // variants are only `high` and `max` budgets, and `medium` for Sol. Sol's
    // `none` variant is left off: "don't think" is not an amount of thinking
    // anyone picks for a coding session.
    models: Object.freeze([
      Object.freeze({
        id: 'anthropic/claude-opus-5-5',
        label: 'Claude Opus 5.5',
        default: true as const,
        effort: levels(CLAUDE_LEVELS, 'high'),
      }),
      Object.freeze({
        id: 'anthropic/claude-fable-5-1',
        label: 'Claude Fable 5.1',
        effort: levels(CLAUDE_LEVELS, 'high'),
      }),
      Object.freeze({
        id: 'anthropic/claude-sonnet-5-5',
        label: 'Claude Sonnet 5.5',
        effort: levels(CLAUDE_LEVELS, 'high'),
      }),
      Object.freeze({
        id: 'anthropic/claude-haiku-4-5',
        label: 'Claude Haiku 4.5',
        effort: levels(['none', 'high', 'max'], 'none'),
      }),
      Object.freeze({
        id: 'openai/gpt-5.6-sol',
        label: 'GPT-5.6 Sol',
        effort: levels(CODEX_LEVELS, 'medium'),
      }),
    ]),
    launch: Object.freeze({
      model: Object.freeze(['--model', '<model>']),
      // OpenCode keys its sessions by project, and a project is the directory
      // it was started in — which for a session is its own worktree, never
      // reused — so `--continue` ("continue the last session", 1.18.33's own
      // `--help`) reopens this session's conversation and nobody else's. Like
      // Codex it names its own conversation, so there is nothing to pin on a
      // create, and with nothing to continue it opens a fresh OpenCode rather
      // than failing.
      conversation: Object.freeze({ resume: Object.freeze(['--continue']) }),
      // Read off opencode 1.18.32's own `--help` and `debug agent build`.
      //
      // The TUI has one approval flag, `--auto` ("auto-approve permissions
      // that are not explicitly denied"), which is Full access. The two levels
      // below it are configuration: `OPENCODE_PERMISSION` inlines a
      // `permission` block, and its rules land *after* the build agent's
      // default `"*": "allow"`, so they win. That default is also why the env
      // is not optional: an Ask started without it would be Full access under
      // another name.
      //
      // Ask asks before edits, commands and anything that reaches the
      // internet; Approve for me lets edits through and still asks for the
      // rest, as Claude Code's `acceptEdits` does. Reads keep OpenCode's own
      // rules, which ask before an `.env` file.
      permission: Object.freeze({
        ask: Object.freeze({
          argv: Object.freeze([]),
          env: Object.freeze({
            OPENCODE_PERMISSION:
              '{"edit":"ask","bash":"ask","webfetch":"ask","websearch":"ask","codesearch":"ask"}',
          }),
        }),
        auto: Object.freeze({
          argv: Object.freeze([]),
          env: Object.freeze({
            OPENCODE_PERMISSION:
              '{"edit":"allow","bash":"ask","webfetch":"ask","websearch":"ask","codesearch":"ask"}',
          }),
        }),
        full: Object.freeze({ argv: Object.freeze(['--auto']), env: Object.freeze({}) }),
      }),
      // A level is the model's *variant*, and the TUI has no flag for one
      // (`--variant` is `opencode run`'s only), so it is inline configuration
      // giving the build agent the model and the variant. The model is named
      // again because OpenCode applies an agent's `variant` only while that
      // agent runs its own configured `model`. `none` is no variant at all.
      effort: Object.freeze({
        argv: Object.freeze([]),
        env: Object.freeze({
          OPENCODE_CONFIG_CONTENT: '{"agent":{"build":{"model":"<model>","variant":"<effort>"}}}',
        }),
        unset: 'none' as const,
      }),
      // `opencode [project] --prompt <text>`, which starts the TUI with the
      // task in it; `opencode run` is the non-interactive one.
      prompt: Object.freeze(['--prompt', '<prompt>']),
    }),
    // No `update`. `opencode upgrade` (1.18.33) has no flag that means "do
    // not ask", and it asks "Install anyways?" whenever it cannot tell how it
    // was installed — which is exactly when replacing it is not ours to do.
    // OpenCode's own launch-time autoupdate skips the same case.
  }),
  grok: Object.freeze({
    id: 'grok',
    label: 'Grok',
    // xAI's Grok Build CLI (`@xai-official/grok`, or `x.ai/cli/install.sh`),
    // whose binary is `grok`.
    command: 'grok',
    // `grok login` signs in through `accounts.x.ai/sign-in`, and `--oauth`
    // through `auth.x.ai`: the two hosts grok 1.0.41 carries for a login.
    // `grok.com` and `console.x.ai` are what it links for a subscription or an
    // API key, not a sign-in, so they stay off the list.
    loginTargets: Object.freeze([
      Object.freeze({ host: 'accounts.x.ai' }),
      Object.freeze({ host: 'auth.x.ai' }),
    ]),
    // `~/.grok/sessions/<url-encoded cwd>/<session id>/`, grouped by working
    // directory as Claude Code's are, per the guide grok installs beside itself.
    transcriptLocation: Object.freeze({
      directory: '~/.grok/sessions/',
      keyedBy: 'working-directory',
    }),
    // "Override config directory (default: `~/.grok`)", and `auth.json` lives
    // in that directory, so it scopes the login and nothing else.
    configDirEnv: 'GROK_HOME',
    // The two Grok generations the CLI offers, with the ids `grok --model`
    // takes. 4.6 is the default because it is the CLI's own (`grok models`
    // on 1.0.41 reads "grok-4.6 (default)"); 4.7 is xAI's newest, first in
    // capability order as Codex's list is. Same seed argument as the others:
    // whether a given account's `grok` offers 4.7 is the probe still open in
    // `product/versions/mvp/05-screens.md`.
    //
    // Which effort levels a Grok model takes comes from xAI's model catalog
    // after sign-in, which this repo has no copy of, so both rows offer the six
    // grok's `--reasoning-effort` knows (`none` left off, as for Sol), with
    // the models' own `high` as the default.
    models: Object.freeze([
      Object.freeze({
        id: 'grok-4.7',
        label: 'Grok 4.7',
        effort: levels(GROK_LEVELS, 'high'),
      }),
      Object.freeze({
        id: 'grok-4.6',
        label: 'Grok 4.6',
        default: true as const,
        effort: levels(GROK_LEVELS, 'high'),
      }),
    ]),
    launch: Object.freeze({
      model: Object.freeze(['--model', '<model>']),
      // The same shape as Claude Code's, and the same constraint read off grok
      // 1.0.44's `--help`: `--session-id` names a **new** conversation and
      // refuses a UUID that already exists, so it is only ever sent on create;
      // `--resume` takes that id back.
      conversation: Object.freeze({
        create: Object.freeze(['--session-id', '<conversation>']),
        resume: Object.freeze(['--resume', '<conversation>']),
      }),
      // `--permission-mode` choices, read off grok 1.0.41's own `--help`:
      // `default | acceptEdits | auto | dontAsk | bypassPermissions | plan`,
      // Claude Code's vocabulary. `default` asks before edits and commands.
      permission: Object.freeze({
        ask: Object.freeze({
          argv: Object.freeze(['--permission-mode', 'default']),
          env: Object.freeze({}),
        }),
        auto: Object.freeze({
          argv: Object.freeze(['--permission-mode', 'acceptEdits']),
          env: Object.freeze({}),
        }),
        full: Object.freeze({
          argv: Object.freeze(['--permission-mode', 'bypassPermissions']),
          env: Object.freeze({}),
        }),
      }),
      // `--reasoning-effort <level>`, which grok refuses to start on a name it lacks.
      effort: Object.freeze({
        argv: Object.freeze(['--reasoning-effort', '<effort>']),
        env: Object.freeze({}),
      }),
      // `grok [OPTIONS] [PROMPT]`, whose help calls the positional "Initial
      // prompt for the interactive session". Not `-p`, which is single-turn
      // and exits.
      prompt: Object.freeze(['<prompt>']),
    }),
    // `grok update`: "Check for updates or install a specific version", grok
    // 1.0.44. Bare, it installs the latest and asks nothing.
    update: Object.freeze(['update']),
  }),
  shell: Object.freeze({
    id: 'shell',
    // The design's own name for it (`product/versions/mvp/design/`).
    label: 'Blank terminal',
    // The host's own login shell, nothing launched in it: a session that is
    // only a worktree and a terminal. No models, no approvals, no effort, and
    // no first task — what somebody types in the composer still names the
    // session, and they type the first command themselves.
    command: '',
    models: Object.freeze([]),
    launch: Object.freeze({}),
  }),
});

const CODING_AGENT_ID_SET = new Set<string>(CODING_AGENT_IDS);

export function isCodingAgentId(value: unknown): value is CodingAgentId {
  return typeof value === 'string' && CODING_AGENT_ID_SET.has(value);
}

/**
 * The effort levels a session of `agent` on `model` offers, or `undefined` when
 * it has none — the blank terminal, Haiku under Claude Code, or a model id the
 * catalog does not list (an alias such as `opus`), whose levels nobody here
 * knows. No model is the agent's default model, because that is what runs.
 */
export function effortFor(
  agent: CodingAgentId,
  model: string | null,
): CodingAgentEffort | undefined {
  const { models } = CODING_AGENTS[agent];
  const row = model === null ? models.find((m) => m.default) : models.find((m) => m.id === model);
  return row?.effort;
}

/**
 * The effort a launch of `agent` on `model` records, given what was asked for:
 * the level when that model offers it, and null — the CLI's own default —
 * otherwise. The one rule for every writer: a session's create, the fold of
 * its log, and an automation's revision. The runner's generated table drops
 * the same levels, so what is recorded is what ran.
 *
 * An agent this build does not know keeps a name from the union: it cannot be
 * checked here, and a newer runner may know it.
 */
export function effortLevelFor(
  agent: string | null,
  model: string | null,
  requested: unknown,
): SessionEffort | null {
  if (!SESSION_EFFORTS.includes(requested as SessionEffort)) return null;
  const level = requested as SessionEffort;
  if (!agent || !isCodingAgentId(agent)) return level;
  return effortFor(agent, model)?.levels.includes(level) ? level : null;
}
