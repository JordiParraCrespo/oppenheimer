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
  /** A tool version string, as a CLI prints it. */
  toolVersion: { min: 1, max: 64 },
  /** `hostname`, `os`, `arch` — short, non-empty, host-reported. */
  hostFact: { min: 1, max: 255 },
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

const hostFactSchema = z.string().min(FIELD_BOUNDS.hostFact.min).max(FIELD_BOUNDS.hostFact.max);

const toolVersionSchema = z
  .string()
  .min(FIELD_BOUNDS.toolVersion.min)
  .max(FIELD_BOUNDS.toolVersion.max);

/**
 * What the runner reports about a machine — **one shape, two arrivals.**
 *
 * Registration sends it over HTTPS before any link exists; `hello` and
 * `heartbeat` send it on the link. It used to be `z.record(z.unknown())` on
 * registration, which meant pairing persisted whatever bag arrived and the link
 * then refused the same host for not matching the structured shape. Storing it
 * as jsonb is a storage detail; it is not a licence to skip the contract.
 *
 * `null` for a tool means "looked, not there" — a fact worth sending, because
 * the console shows it as a hint on the agent chip and only `tmux` is a hard
 * requirement.
 */
export const hostFactsSchema = z.object({
  hostname: hostFactSchema,
  os: hostFactSchema,
  arch: hostFactSchema,
  /** `git`, `tmux`, and each agent's command. */
  tools: z.record(toolVersionSchema.nullable()),
  /** Agents detected on PATH, with the version if the CLI reported one. */
  agents: z.array(
    z.object({
      id: codingAgentSchema,
      version: toolVersionSchema.nullable(),
    }),
  ),
});

export type HostFactsDto = z.infer<typeof hostFactsSchema>;
