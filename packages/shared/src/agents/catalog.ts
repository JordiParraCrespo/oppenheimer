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
 * This module is data. The only function is the type guard, because a closed
 * union needs one at every boundary a string arrives at.
 */

/** Every agent id, in display order. Extend the tuple as agents are added. */
export const CODING_AGENT_IDS = ['claude-code', 'codex'] as const;

/** A coding agent this product knows how to launch. */
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
 * How hard the agent may think, as the five stops the effort slider draws.
 *
 * A product ordinal, not a passthrough: each agent states below what each stop
 * means in its own vocabulary, because no two CLIs name these the same and a
 * reader is choosing an amount of thinking, not a flag.
 */
export const SESSION_EFFORTS = ['minimal', 'low', 'medium', 'high', 'max'] as const;

export type SessionEffort = (typeof SESSION_EFFORTS)[number];

/** One model the engine button offers, inside its agent's pane. */
export interface CodingAgentModel {
  /** Passed to the agent verbatim, so it is a name that CLI's `--model` takes. */
  readonly id: string;
  /** What the button and the row read ("Claude Opus 5"). */
  readonly label: string;
  /** Offered first, and what a session with no model chosen runs. */
  readonly default?: true;
}

/**
 * How one agent is told what the person chose: argv, not prose.
 *
 * Every entry is the **argument vector** to append to `command`, so the runner
 * concatenates rather than parses, and a value that would need quoting cannot
 * become a second word by accident. `<model>` is the one placeholder, and it is
 * substituted whole.
 *
 * The maps are total on purpose. An agent whose own vocabulary is coarser than
 * the five stops says so by repeating itself — which is a fact about that CLI,
 * stated here once, instead of a gap every call site has to handle.
 */
export interface CodingAgentLaunch {
  /** Absent: this agent takes no model. */
  readonly model?: readonly string[];
  readonly permission: Readonly<Record<SessionPermission, readonly string[]>>;
  /** Absent: this agent has no notion of effort, and the console hides the slider. */
  readonly effort?: Readonly<Record<SessionEffort, readonly string[]>>;
  /**
   * How the person's first task reaches the agent, with `<prompt>` substituted
   * whole — always the **last** argv appended, because both CLIs take it as a
   * trailing positional.
   *
   * It is a launch option and not a message typed at a running process, which
   * is the whole reason it is here: writing into window 0 once the TUI is up
   * is neither how these CLIs take a first task nor a thing with a moment you
   * can name, and `product/versions/mvp/02-runner.md` §5 is what that would
   * have raced with. Appended to argv, the task is present before the agent
   * starts and there is nothing to synchronise.
   *
   * Absent: this agent takes no task on the command line, and the person types
   * the first one themselves.
   */
  readonly prompt?: readonly string[];
}

/** One agent's launch and inspection facts. */
export interface CodingAgentDefinition {
  readonly id: CodingAgentId;
  /** Human-readable name, for the agent chip. */
  readonly label: string;
  /** The executable the runner launches inside the session's tmux window. */
  readonly command: string;
  /**
   * `RegExp` **source** matching the vendor login URL the CLI prints when it
   * needs an account, so the console can turn it into a button.
   *
   * It is a source string rather than a `RegExp` so this stays plain data, and
   * it is anchored on purpose: `claude.ai` and `claude.ai.attacker.test` differ
   * by a suffix, and an unanchored or substring match would hand a person a
   * button to the second one (`product/04-security-review.md`, F3).
   *
   * **This is the only statement of it.** The link enforces it —
   * `sessionSnapshotSchema.loginUrl` in `../protocol/primitives.ts` checks a
   * reported URL against the reporting agent's pattern, and the constraint
   * survives into the emitted JSON Schema, so the generated runner code refuses a
   * lookalike host where the control plane does. The runner's existing allowlist
   * in `apps/runner/internal/sessions/adapters/manifest/engine.go` is the twin
   * this replaces; it is retired when the runner consumes the generated types
   * (its own slice), and until then the two must not be edited apart.
   */
  readonly loginUrlPattern: string;
  /** Where the CLI writes the transcript the first prompt is read from. */
  readonly transcriptLocation: CodingAgentTranscriptLocation;
  /**
   * The environment variable that scopes the agent's credential to a
   * directory. One login per configuration directory, not one per machine —
   * which is what makes the later accounts slice possible without changing
   * anything global on the host.
   */
  readonly configDirEnv: string;
  /**
   * The models the engine button offers for this agent, in display order.
   *
   * Empty is a real answer and not a gap: the console picks such an agent
   * outright and the button names the agent itself, which is what a blank
   * terminal wants. Both agents here carry a **seed** — the models their CLI
   * documents, not ids invented for the picker — and which of them a given
   * machine's CLI actually knows is the probe still open in
   * `product/versions/mvp/05-screens.md`.
   */
  readonly models: readonly CodingAgentModel[];
  /** What the person's three choices mean to this CLI. */
  readonly launch: CodingAgentLaunch;
}

/**
 * The catalog. Frozen because it is shared mutable state otherwise: the API,
 * the console and the CLI all read the same object.
 */
export const CODING_AGENTS: Readonly<Record<CodingAgentId, CodingAgentDefinition>> = Object.freeze({
  'claude-code': Object.freeze({
    id: 'claude-code',
    label: 'Claude Code',
    command: 'claude',
    loginUrlPattern: '^https://(claude\\.ai|console\\.anthropic\\.com)(/[^\\s]*)?$',
    transcriptLocation: Object.freeze({
      directory: '~/.claude/projects/',
      keyedBy: 'working-directory',
    }),
    configDirEnv: 'CLAUDE_CONFIG_DIR',
    // The family, one row per model, named as the person choosing it knows it.
    //
    // Pinned ids rather than the aliases `claude --help` also takes (`opus`,
    // `sonnet`, `fable`): a row's label names a generation, so its id has to
    // name the same one. An alias under a versioned label is the pair that can
    // drift apart silently — the day the alias moves, the button keeps saying
    // "Claude Opus 5" while the host runs something else. A pinned id can only
    // go stale in the open: the row still runs what it says, and the list is
    // one edit behind until somebody adds the next model here.
    //
    // This is the **seed**. Whether a given host's `claude` knows a given id is
    // a host fact, and the probe that would report it is open question 6 in
    // `product/versions/mvp/05-screens.md`; until it lands, an id this list
    // names and that CLI does not fails in the session's own terminal, where
    // the person can see it.
    models: Object.freeze([
      Object.freeze({ id: 'claude-fable-5-1', label: 'Claude Fable 5.1' }),
      Object.freeze({ id: 'claude-opus-5', label: 'Claude Opus 5', default: true as const }),
      Object.freeze({ id: 'claude-sonnet-5', label: 'Claude Sonnet 5' }),
      Object.freeze({ id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' }),
    ]),
    launch: Object.freeze({
      model: Object.freeze(['--model', '<model>']),
      permission: Object.freeze({
        // `--permission-mode` choices, read off claude 2.1.278's own `--help`.
        ask: Object.freeze(['--permission-mode', 'manual']),
        auto: Object.freeze(['--permission-mode', 'acceptEdits']),
        full: Object.freeze(['--permission-mode', 'bypassPermissions']),
      }),
      // `--effort` takes low | medium | high | xhigh | max — five levels for
      // five stops, so this is order-preserving and every stop is distinct.
      // "Minimal" is the slider's floor, not a level claude has; it maps to the
      // lowest one there is.
      effort: Object.freeze({
        minimal: Object.freeze(['--effort', 'low']),
        low: Object.freeze(['--effort', 'medium']),
        medium: Object.freeze(['--effort', 'high']),
        high: Object.freeze(['--effort', 'xhigh']),
        max: Object.freeze(['--effort', 'max']),
      }),
      // `claude [options] [command] [prompt]`, whose own help calls the
      // positional "Your prompt" and the default mode "an interactive
      // session" — so this starts the TUI with the task already in it.
      prompt: Object.freeze(['<prompt>']),
    }),
  }),
  codex: Object.freeze({
    id: 'codex',
    label: 'Codex',
    command: 'codex',
    loginUrlPattern:
      '^https://(auth\\.openai\\.com|platform\\.openai\\.com|chatgpt\\.com)(/[^\\s]*)?$',
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
    models: Object.freeze([
      Object.freeze({ id: 'gpt-6-astra', label: 'GPT-6 Astra' }),
      Object.freeze({ id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', default: true as const }),
      Object.freeze({ id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' }),
      Object.freeze({ id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' }),
    ]),
    launch: Object.freeze({
      model: Object.freeze(['--model', '<model>']),
      permission: Object.freeze({
        // Read off codex-cli 0.155.1's own `--help`. `--approve-for-me` is that
        // CLI's own name for the middle level, and is more than the flag pair it
        // replaces: it routes approvals through an automatic review.
        ask: Object.freeze(['--ask-for-approval', 'on-request', '--sandbox', 'workspace-write']),
        auto: Object.freeze(['--approve-for-me']),
        full: Object.freeze(['--dangerously-bypass-approvals-and-sandbox']),
      }),
      // Codex has no effort flag; it is the `model_reasoning_effort` config key,
      // set per invocation with `-c`. Its config reference runs to `xhigh`, so
      // the slider's top two stops are distinct and only `minimal` is below
      // what the reference lists.
      //
      // These names are the one thing in this file not read off a `--help`: the
      // CLI accepts an unrecognised value without failing, so a wrong name costs
      // the setting rather than the launch.
      effort: Object.freeze({
        minimal: Object.freeze(['-c', 'model_reasoning_effort=minimal']),
        low: Object.freeze(['-c', 'model_reasoning_effort=low']),
        medium: Object.freeze(['-c', 'model_reasoning_effort=medium']),
        high: Object.freeze(['-c', 'model_reasoning_effort=high']),
        max: Object.freeze(['-c', 'model_reasoning_effort=xhigh']),
      }),
      // `codex [OPTIONS] [PROMPT]`, documented as "Optional user prompt to
      // start the session". Not the `exec` subcommand, which is the
      // non-interactive one and would give the person no terminal to take over.
      prompt: Object.freeze(['<prompt>']),
    }),
  }),
});

const CODING_AGENT_ID_SET = new Set<string>(CODING_AGENT_IDS);

/** Type guard: is `value` an agent in the catalog? */
export function isCodingAgentId(value: unknown): value is CodingAgentId {
  return typeof value === 'string' && CODING_AGENT_ID_SET.has(value);
}
