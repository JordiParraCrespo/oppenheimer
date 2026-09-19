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
  }),
});

const CODING_AGENT_ID_SET = new Set<string>(CODING_AGENT_IDS);

/** Type guard: is `value` an agent in the catalog? */
export function isCodingAgentId(value: unknown): value is CodingAgentId {
  return typeof value === 'string' && CODING_AGENT_ID_SET.has(value);
}
