import { z } from 'zod/v4';
import {
  CODING_AGENT_IDS,
  CODING_AGENTS,
  SESSION_EFFORTS,
  SESSION_PERMISSIONS,
} from '../agents/catalog';
import { FIELD_BOUNDS, HOST_PLATFORMS, promptByteLength } from '../schemas/primitives';

/**
 * The pieces more than one message is built from. Nothing here is a message:
 * every message lives in `./messages.ts` and carries a `type` discriminator.
 *
 * The bounds come from `../schemas/primitives`, so a length written down for a
 * DTO is the same length on the wire. The schema *objects* cannot be shared —
 * this module is built on `zod/v4` so the JSON Schema emitter can read it, the
 * DTOs on classic `zod` — and `src/__tests__/cross-version-primitives.spec.ts`
 * is what holds the two in step until the package is on one Zod line.
 */

/** A control-plane id. Every table in the design has a UUID primary key. */
export const sessionIdSchema = z.uuid();
export const checkoutIdSchema = z.uuid();

/**
 * Every command is idempotent by session id and command id, because a reconnect
 * may redeliver it.
 */
export const commandIdSchema = z.uuid();

/**
 * An **attachment** is one PTY on one window for one browser connection. It is
 * the unit of streaming, of flow control and of resize, and it is what a binary
 * frame's 4-byte big-endian prefix names — hence the range.
 */
export const attachmentIdSchema = z.number().int().min(0).max(0xffffffff);

/** A tmux window index. Tabs are tmux windows, so a ticket authorises one window. */
export const windowIndexSchema = z.number().int().min(0);

/** GitHub's own numeric repository id. */
export const githubRepoIdSchema = z.number().int().positive();

/** The agent a session runs. The catalog is the closed union; see `../agents/catalog`. */
export const protocolAgentSchema = z.enum(CODING_AGENT_IDS);

/**
 * How the agent is started, as the host receives it.
 *
 * **Structured, never argv.** The control plane says which of the product's
 * three permission levels and five effort stops somebody chose; the host is
 * what turns that into a command line, from the same catalog this schema takes
 * its unions from. A control plane that sent argv would be dictating a command
 * to run on somebody's laptop, and the runner would have nothing left to check
 * — so the mapping stays on the machine that executes it
 * (`product/versions/mvp/01-protocol.md`, and
 * `02-runner.md` §5 for what the runner then does with it).
 *
 * `permission` is required here although the DTO defaults it: by the time a
 * launch reaches a host the choice has been made, and an absent level on the
 * wire would be a second place deciding what "unspecified" means.
 */
export const launchOptionsSchema = z.object({
  model: z.string().min(1).max(128).optional(),
  permission: z.enum(SESSION_PERMISSIONS),
  effort: z.enum(SESSION_EFFORTS).optional(),
});

export type LaunchOptions = z.infer<typeof launchOptionsSchema>;

/**
 * The first task, bounded by the same rule the DTO is bounded by: 2 KB of
 * UTF-8, which is what `02-runner.md` §7 states and what the event log can
 * actually keep (its payloads are capped at 8 KiB of serialized JSON).
 */
export const promptTextSchema = z
  .string()
  .min(FIELD_BOUNDS.prompt.min)
  // Documentable upper bound, then the rule; see the DTO schema's note.
  .max(FIELD_BOUNDS.prompt.maxBytes)
  .refine((value) => promptByteLength(value) <= FIELD_BOUNDS.prompt.maxBytes);

/**
 * Every catalog login pattern, or-ed into one anchored expression.
 *
 * Derived from the catalog rather than restated, so a new agent's vendor is
 * admitted by adding it there and nowhere else. Each entry is already anchored,
 * so the anchors are stripped before joining and re-applied once — an unanchored
 * alternative would reopen the suffix hole the anchors exist to close (F3).
 */
const ANY_VENDOR_LOGIN_URL = new RegExp(
  `^(?:${Object.values(CODING_AGENTS)
    .map((agent) => agent.loginUrlPattern.replace(/^\^/, '').replace(/\$$/, ''))
    .join('|')})$`,
);

/** A git ref or a slug — a short, non-empty, path-safe string on the wire. */
export const gitRefSchema = z.string().min(FIELD_BOUNDS.gitRef.min).max(FIELD_BOUNDS.gitRef.max);

/**
 * The protocol range a runner speaks. The control plane reconciles against it at
 * hello rather than assuming the version it shipped.
 */
export const protocolRangeSchema = z.object({
  min: z.number().int().min(1),
  max: z.number().int().min(1),
});

/**
 * One probed executable. The wire half of `hostToolSchema` in
 * `../schemas/primitives`; see there for why `path` absent means "not found" and
 * why an agent is just a tool.
 */
export const hostToolSchema = z.object({
  name: z.string(),
  path: z.string().optional(),
  version: z.string().optional(),
  required: z.boolean(),
});

/**
 * What the runner last saw about the machine — the wire half of
 * `hostFactsSchema` in `../schemas/primitives`, which registration uses.
 *
 *
 * Agents installed on a host are read from `tools` — the entries named `claude`
 * and `codex` — and there is no separate agents key; that is what the console
 * consumes for the agent chip.
 *
 * Both mirror `Facts` in `apps/runner/internal/host/domain/facts.go` verbatim,
 * because the runner marshals that struct whole into both `POST /hosts/register`
 * and this link. Keep the two identical; the conformance spec fails otherwise.
 */
export const hostFactsSchema = z.object({
  platform: z.enum(HOST_PLATFORMS),
  osVersion: z.string().optional(),
  arch: z.string(),
  hostname: z.string(),
  user: z.string(),
  home: z.string(),
  root: z.boolean(),
  /** `null` when the Go slice was nil, normalised so consumers never branch on it. */
  tools: z
    .array(hostToolSchema)
    .nullable()
    .transform((tools) => tools ?? []),
  workspacePath: z.string(),
  diskFreeBytes: z.number().int().min(0),
  runnerVersion: z.string(),
});

/**
 * The **agent observation** vocabulary — the middle of the design's three state
 * vocabularies. These are inputs reported as events, never a session state:
 * `done` folds in with `idle` as "ready for a prompt" and `unknown` counts as
 * not-ready, which is what makes a launch look stuck.
 */
export const OBSERVED_AGENT_STATES = ['working', 'blocked', 'idle', 'done', 'unknown'] as const;

export type ObservedAgentState = (typeof OBSERVED_AGENT_STATES)[number];

export const observedAgentStateSchema = z.enum(OBSERVED_AGENT_STATES);

/**
 * One session as the host currently holds it. Sent in bulk at hello, where the
 * control plane reconciles against its own state rather than replaying a queue,
 * and per session on every heartbeat.
 *
 * **`loginUrl` is validated against the reporting agent's own login pattern**,
 * not merely as a URL. A free-form URL here would be F3 straight through: this
 * is the one field the console turns into a clickable button, and
 * `https://claude.ai.attacker.test/oauth` parses as a perfectly good URL. The
 * catalog's anchored pattern is therefore enforced on the wire, which is what
 * makes it a control rather than a comment.
 */
export const sessionSnapshotSchema = z
  .object({
    sessionId: sessionIdSchema,
    agent: protocolAgentSchema,
    observed: observedAgentStateSchema,
    /**
     * How long the session has been in `observed`, measured from a **recorded
     * transition** and never from a live probe: it is non-zero only when the
     * observation equals the last recorded one, so a caller with no history
     * cannot fabricate "blocked for five minutes" and move a healthy session
     * into `waiting-on-you`.
     */
    stateSeconds: z.number().int().min(0),
    windows: z.array(
      z.object({
        index: windowIndexSchema,
        name: z.string().max(FIELD_BOUNDS.displayName.max).optional(),
      }),
    ),
    /** The agent's own conversation id, once it has one. */
    agentSessionId: z.string().min(1).nullable(),
    /**
     * Hash of the agent's last report. `ready-for-review` versus `idle` is this
     * against the acknowledged hash — "finished and you have not looked" needs no
     * read-receipt table.
     */
    reportHash: z.string().min(1).nullable(),
    /**
     * The vendor login URL the classifier saw.
     *
     * Two checks, on purpose. The `regex` is the union of every catalog pattern,
     * so it **survives emission to JSON Schema** and the generated Go refuses
     * `https://claude.ai.attacker.test/oauth` exactly where the control plane
     * does. The `superRefine` below then narrows it to the *reporting agent's*
     * own vendor, which depends on a sibling field and so can only live in Zod.
     */
    loginUrl: z.string().regex(ANY_VENDOR_LOGIN_URL).nullable(),
  })
  .superRefine((snapshot, ctx) => {
    if (snapshot.loginUrl === null) return;
    const pattern = new RegExp(CODING_AGENTS[snapshot.agent].loginUrlPattern);
    if (!pattern.test(snapshot.loginUrl)) {
      ctx.addIssue({ code: 'custom', path: ['loginUrl'] });
    }
  });

export type SessionSnapshot = z.infer<typeof sessionSnapshotSchema>;

/**
 * Name everything the emitter would otherwise reuse anonymously.
 *
 * `reused: 'ref'` lifts any schema used more than once into `$defs`, and without
 * ids those become `__schema0`, `__schema1`, … — which is what the Go generator
 * would name the types it produces. Naming them here is the difference between
 * `SessionSnapshot` and `Schema0` on the other side of the contract.
 *
 * The snapshot is the one that matters for correctness: named and `$ref`'d, a
 * field added to it cannot land in `hello` and miss `heartbeat`.
 */
for (const [id, schema] of [
  ['sessionSnapshot', sessionSnapshotSchema],
  ['hostFacts', hostFactsSchema],
  ['hostTool', hostToolSchema],
  ['codingAgentId', protocolAgentSchema],
  ['observedAgentState', observedAgentStateSchema],
  ['sessionId', sessionIdSchema],
  ['checkoutId', checkoutIdSchema],
  ['commandId', commandIdSchema],
  ['attachmentId', attachmentIdSchema],
  ['windowIndex', windowIndexSchema],
  ['githubRepoId', githubRepoIdSchema],
  ['gitRef', gitRefSchema],
] as const) {
  z.globalRegistry.add(schema, { id });
}
