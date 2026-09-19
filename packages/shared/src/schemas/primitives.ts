import { z } from 'zod';
import { CODING_AGENT_IDS } from '../agents/catalog';

/**
 * The nouns more than one schema spells, defined once.
 *
 * Two of them were duplicated before and are the reason this file exists: a
 * GitHub repository id was written out in both the session DTO and the wire, and
 * host facts were a structured shape on the wire but an opaque bag on
 * registration. Both are single definitions now.
 *
 * The bare constants below are exported because the protocol module cannot
 * import these schema *objects* — it is built on a different Zod entry point —
 * but it can and does build its own from the same numbers and tuples, and
 * `src/__tests__/cross-version-primitives.spec.ts` asserts the two agree.
 *
 * Schemas state the constraint only, never a message (`.agents/rules/forms.md`).
 */

/** Bounds shared with the wire. Change them here and the conformance spec follows. */
export const FIELD_BOUNDS = {
  /** A host's display name, and the intended name a pairing token carries. */
  hostName: { min: 1, max: 80 },
  /** A project or session display name. */
  displayName: { min: 1, max: 200 },
  /** A git ref: branch names are bounded by what git and the filesystem take. */
  gitRef: { min: 1, max: 255 },
} as const;

/**
 * **Two different ids that used to share a name.**
 *
 * A control-plane row is a UUID we minted; GitHub's own ids are numbers it
 * minted. A connect-then-create flow touches both within a minute, so they are
 * never both called `installationId`.
 */

/** `github_installation.id` — our row. */
export const installationIdSchema = z.string().uuid();

/** GitHub's installation id, as it arrives on the App redirect. */
export const githubInstallationIdSchema = z.number().int().positive();

/** GitHub's repository id. The picker is a live listing, so no row need exist yet. */
export const githubRepoIdSchema = z.number().int().positive();

/** The agent a session runs. The catalog is the closed union; see `../agents/catalog`. */
export const codingAgentSchema = z.enum(CODING_AGENT_IDS);

export const hostNameSchema = z
  .string()
  .min(FIELD_BOUNDS.hostName.min)
  .max(FIELD_BOUNDS.hostName.max);

export const displayNameSchema = z
  .string()
  .min(FIELD_BOUNDS.displayName.min)
  .max(FIELD_BOUNDS.displayName.max);

export const gitRefSchema = z.string().min(FIELD_BOUNDS.gitRef.min).max(FIELD_BOUNDS.gitRef.max);

/**
 * The host family, at the granularity the installer and the service manager care
 * about. `unsupported` is a real value the runner sends, not an error: it detects
 * the platform, names it, and the control plane refuses with the supported list.
 */
export const HOST_PLATFORMS = ['macos', 'debian', 'ubuntu', 'linux', 'unsupported'] as const;

export type HostPlatform = (typeof HOST_PLATFORMS)[number];

export const hostPlatformSchema = z.enum(HOST_PLATFORMS);

/**
 * One executable a session depends on, as the runner probed it.
 *
 * `path` absent means it is not on PATH — that is how "looked, not there" is
 * expressed, because Go omits the empty string. An agent is just a probed tool
 * (`claude`, `codex`), which is why there is no separate agents list: deriving
 * one by name costs a filter and keeps a single source for "what is installed".
 * `name` is a free-form string rather than an enum because the runner owns the
 * probe list and adding `codex` to it must not require a control-plane release.
 */
export const hostToolSchema = z.object({
  name: z.string(),
  /** Absolute path, omitted when the tool was not found. */
  path: z.string().optional(),
  /** As the CLI reported it, omitted when unknown. */
  version: z.string().optional(),
  /** Whether its absence stops sessions. `git` and `tmux` are required; agents are not. */
  required: z.boolean(),
});

export type HostToolDto = z.infer<typeof hostToolSchema>;

/**
 * What the runner reports about a machine — **one shape, two arrivals**, and it
 * is the runner's shape verbatim.
 *
 * This mirrors `Facts` in `apps/runner/internal/host/domain/facts.go` key for key
 * and tag for tag, because the runner marshals that struct whole into
 * `POST /hosts/register` and into `hello`/`heartbeat`. The register JSON is the
 * runner's to define; this schema follows it. An earlier version invented
 * `hostname`/`os`/`arch` with a `tools` map and an `agents` array, which no
 * runner has ever sent — a real registration would have been a 400.
 *
 *
 * Agents installed on a host are read from `tools` — the entries named `claude`
 * and `codex` — and there is no separate agents key; that is what the console
 * consumes for the agent chip.
 *
 * Two deliberate loosenings, both so that a truthful runner cannot be refused:
 *
 * - the non-`omitempty` strings accept `''`. Go always emits those keys, and
 *   `workspacePath` genuinely can be empty (`service.go` guards `s.workspace !== ''`
 *   before measuring disk), so a `min(1)` here would 400 exactly the host this
 *   change exists to admit;
 * - `tools` accepts `null`. A nil Go slice marshals to `null`, not `[]`, and the
 *   field has no `omitempty`; it is normalised to an empty array so consumers
 *   never branch on it.
 */
export const hostFactsSchema = z.object({
  platform: hostPlatformSchema,
  /** Omitted when the prober could not determine it. */
  osVersion: z.string().optional(),
  arch: z.string(),
  hostname: z.string(),
  /** The account the runner runs as, and its home. Never root — `root` reports that. */
  user: z.string(),
  home: z.string(),
  /** True is a refusal condition, reported rather than hidden. */
  root: z.boolean(),
  /** A probe result per tool: `git`, `tmux`, `claude`, and `codex` when it is probed. */
  tools: z
    .array(hostToolSchema)
    .nullable()
    .transform((tools) => tools ?? []),
  /** Where `~/oppenheimer-ai` lives on this host. May be empty before it is chosen. */
  workspacePath: z.string(),
  /** Free bytes on the workspace filesystem. A JSON number; `uint64` in Go. */
  diskFreeBytes: z.number().int().min(0),
  runnerVersion: z.string(),
});

export type HostFactsDto = z.infer<typeof hostFactsSchema>;
