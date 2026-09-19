import { z } from 'zod/v4';
import { CODING_AGENT_IDS } from '../agents/catalog';

/**
 * The pieces more than one message is built from. Nothing here is a message:
 * every message lives in `./messages.ts` and carries a `type` discriminator.
 */

/** A control-plane id. Every table in the design has a UUID primary key. */
export const sessionIdSchema = z.uuid();
export const checkoutIdSchema = z.uuid();

/**
 * Every command is idempotent by session id and command id, because a
 * reconnect may redeliver it (`product/versions/mvp/01-protocol.md`).
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
 * The protocol range a runner speaks. The control plane reconciles against it
 * at hello rather than assuming the version it shipped.
 */
export const protocolRangeSchema = z.object({
  min: z.number().int().min(1),
  max: z.number().int().min(1),
});

/**
 * A tool the runner found, and the version it reported. `null` means "looked
 * and it is not there" — which is a fact worth sending, because the console
 * shows it as a hint on the agent chip and `tmux` missing is the one hard
 * failure.
 */
export const toolVersionsSchema = z.record(z.string().min(1), z.string().min(1).nullable());

/**
 * What the runner last saw about the machine. Opaque to the schema beyond its
 * shape: it lands on `host.capabilities` as jsonb, is a hint and never a gate.
 */
export const hostFactsSchema = z.object({
  hostname: z.string().min(1),
  os: z.string().min(1),
  arch: z.string().min(1),
  /** `git`, `tmux`, and each agent's command. */
  tools: toolVersionsSchema,
  /** Agents detected on PATH, with the version if the CLI reported one. */
  agents: z.array(
    z.object({
      id: protocolAgentSchema,
      version: z.string().min(1).nullable(),
    }),
  ),
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
 */
export const sessionSnapshotSchema = z.object({
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
      name: z.string().max(200).optional(),
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
  /** The vendor login URL the classifier saw, which the console turns into a button. */
  loginUrl: z.url().nullable(),
});

export type SessionSnapshot = z.infer<typeof sessionSnapshotSchema>;
