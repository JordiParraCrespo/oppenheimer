import { z } from 'zod/v4';
import { hintSchema } from './hint';
import {
  attachmentIdSchema,
  checkoutIdSchema,
  commandIdSchema,
  githubRepoIdSchema,
  hostFactsSchema,
  protocolAgentSchema,
  protocolRangeSchema,
  sessionIdSchema,
  sessionSnapshotSchema,
  toolVersionsSchema,
  windowIndexSchema,
} from './primitives';

/**
 * The runner link's message vocabulary, as Zod — one source of truth, with JSON
 * Schema emitted from it (`pnpm --filter @oppenheimer/shared build:protocol`)
 * and the Go structs generated from that. This settles open question 1 of
 * `product/versions/mvp/01-protocol.md`: Zod is what this repo already uses for
 * DTOs, so the wire is not a second schema language.
 *
 * Only **control messages** are here. PTY bytes travel as binary frames — one
 * frame per PTY read, a 4-byte big-endian attachment id and then the bytes, no
 * JSON wrapping and no base64 — and nothing in this file describes them.
 */

/* ------------------------------------------------------------------ runner → control plane */

/**
 * The first message after the upgrade. The control plane reconciles the
 * snapshot against its own state rather than replaying a queue, and refuses a
 * runner below `min_supported` with an `update_required` hint rather than
 * dropping it.
 */
export const helloSchema = z.object({
  type: z.literal('hello'),
  runnerVersion: z.string().min(1).max(64),
  protocol: protocolRangeSchema,
  /**
   * A random id the runner mints at process start. Event idempotency keys are
   * `<runId>:<n>`, so they depend on nothing the control plane hands out and
   * survive any reconnect.
   */
  runId: z.string().min(1).max(64),
  host: hostFactsSchema,
  /** Every session this host holds, however the control plane thinks they stand. */
  sessions: z.array(sessionSnapshotSchema),
});

export type HelloMessage = z.infer<typeof helloSchema>;

/** Every 15 s. What changes about a host and its sessions while nothing is asked of it. */
export const heartbeatSchema = z.object({
  type: z.literal('heartbeat'),
  sentAt: z.iso.datetime(),
  runnerVersion: z.string().min(1).max(64),
  /** The update channel this host follows, so the control plane can offer the right release. */
  channel: z.string().min(1).max(64),
  load: z.object({
    /** One-minute load average, as the kernel reports it. */
    loadAverage1m: z.number().min(0),
    /** Free bytes on the filesystem holding `~/oppenheimer-ai/workspaces`. */
    workspacesFreeBytes: z.number().int().min(0),
  }),
  /** `git`, `tmux` and each agent's command, re-read so a host upgrade is visible. */
  tools: toolVersionsSchema,
  sessions: z.array(sessionSnapshotSchema),
});

export type HeartbeatMessage = z.infer<typeof heartbeatSchema>;

/** The cap on one event's payload. It never carries pane text: PTY bytes never reach Postgres. */
export const PROTOCOL_MAX_EVENT_PAYLOAD_BYTES = 8 * 1024;

const jsonObjectSchema = z.record(z.string(), z.unknown());

/**
 * UTF-8 byte length, computed rather than measured with `TextEncoder`: this
 * package is shared with the browser and with a CJS build, and a global that
 * exists in both but is typed in neither is not worth a `lib` change.
 */
function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code < 0x10000) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

/**
 * One entry for a session's append-only log, which is the truth per session.
 *
 * `seq` is absent on purpose: it is assigned by the **control plane** under a
 * row lock, so a buggy or hostile host cannot create gaps or regress the log.
 * What the writer owns is `idempotencyKey`, `<runId>:<n>`, which makes a batch
 * replayed after a dropped ack append only what was not yet seen.
 */
export const sessionEventSchema = z.object({
  idempotencyKey: z
    .string()
    .min(3)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+:\d+$/),
  kind: z.string().min(1).max(64),
  payload: jsonObjectSchema.refine(
    (payload) => utf8ByteLength(JSON.stringify(payload)) <= PROTOCOL_MAX_EVENT_PAYLOAD_BYTES,
  ),
  occurredAt: z.iso.datetime(),
});

export type SessionEvent = z.infer<typeof sessionEventSchema>;

/** A batch for one session's log. The append and the fold happen in one transaction. */
export const eventsAppendSchema = z.object({
  type: z.literal('events.append'),
  sessionId: sessionIdSchema,
  events: z.array(sessionEventSchema).min(1).max(256),
});

export type EventsAppendMessage = z.infer<typeof eventsAppendSchema>;

/* ------------------------------------------------------------------ control plane → runner */

/**
 * Launch a session: the directories to make, the repositories to check out, and
 * where the agent starts.
 *
 * Every path segment is a unique-constrained column, so the runner derives
 * `workspaces/<organizationSlug>/projects/<projectSlug>/sessions/<sessionSlug>/`
 * without asking. `branch` is always the session's own
 * `oppenheimer/<project>/<session>`, created from each checkout's base and
 * never the base itself.
 */
export const sessionCreateSchema = z.object({
  type: z.literal('session.create'),
  commandId: commandIdSchema,
  sessionId: sessionIdSchema,
  organizationSlug: z.string().min(1).max(255),
  projectSlug: z.string().min(1).max(255),
  sessionSlug: z.string().min(1).max(255),
  agent: protocolAgentSchema,
  /**
   * A launch option of the agent, not a column and not a table anywhere: it is
   * recorded in the log, so promoting it later is a replay rather than a
   * backfill of data nobody captured.
   */
  model: z.string().min(1).max(128).optional(),
  branch: z.string().min(1).max(255),
  checkouts: z.array(
    z.object({
      checkoutId: checkoutIdSchema,
      githubRepoId: githubRepoIdSchema,
      repositoryFullName: z.string().min(1).max(255),
      /** Never reused inside a session: a retired name would inherit a stranger's history. */
      directoryName: z.string().min(1).max(255),
      baseBranch: z.string().min(1).max(255),
    }),
  ),
  /**
   * Where the agent is launched. Set, it starts inside that checkout with the
   * others as `../siblings`; null, it starts in the session directory with
   * every checkout a peer.
   */
  cwdCheckoutId: checkoutIdSchema.nullable(),
});

export type SessionCreateMessage = z.infer<typeof sessionCreateSchema>;

/** Open a PTY on one window for one browser connection. The control plane allocates the id. */
export const sessionAttachSchema = z.object({
  type: z.literal('session.attach'),
  commandId: commandIdSchema,
  sessionId: sessionIdSchema,
  window: windowIndexSchema,
  attachmentId: attachmentIdSchema,
  /** The browser's viewport at attach, so the pane is not resized a frame later. */
  cols: z.number().int().min(1).max(10_000),
  rows: z.number().int().min(1).max(10_000),
});

export type SessionAttachMessage = z.infer<typeof sessionAttachSchema>;

/**
 * Write to a session's PTY from the control plane — the first prompt, or a
 * command the console sends without a pane open.
 *
 * Interactive keystrokes do **not** come this way: they are binary frames on
 * the attach socket, relayed as binary frames on the link. This message exists
 * for input the control plane originates, which is why the bytes are base64 in
 * a JSON control frame rather than raw.
 */
export const sessionInputSchema = z.object({
  type: z.literal('session.input'),
  commandId: commandIdSchema,
  sessionId: sessionIdSchema,
  window: windowIndexSchema,
  data: z.base64(),
});

export type SessionInputMessage = z.infer<typeof sessionInputSchema>;

/** Resize one attachment's PTY. Resize is per attachment, not per window. */
export const sessionResizeSchema = z.object({
  type: z.literal('session.resize'),
  commandId: commandIdSchema,
  sessionId: sessionIdSchema,
  attachmentId: attachmentIdSchema,
  cols: z.number().int().min(1).max(10_000),
  rows: z.number().int().min(1).max(10_000),
});

export type SessionResizeMessage = z.infer<typeof sessionResizeSchema>;

/** Open a new tmux window in the session. Tabs in the console are tmux windows. */
export const sessionWindowOpenSchema = z.object({
  type: z.literal('session.window.open'),
  commandId: commandIdSchema,
  sessionId: sessionIdSchema,
  name: z.string().min(1).max(200).optional(),
});

export type SessionWindowOpenMessage = z.infer<typeof sessionWindowOpenSchema>;

/** Close one tmux window. The session survives its windows. */
export const sessionWindowCloseSchema = z.object({
  type: z.literal('session.window.close'),
  commandId: commandIdSchema,
  sessionId: sessionIdSchema,
  window: windowIndexSchema,
});

export type SessionWindowCloseMessage = z.infer<typeof sessionWindowCloseSchema>;

/**
 * Close the session: push each checkout's branch, then remove the worktrees and
 * prune.
 *
 * It **refuses when a checkout has unpushed work** unless the caller explicitly
 * accepts the loss, never passes `git worktree remove --force`, and relays
 * git's own refusal verbatim rather than paraphrasing it. Stopping a session is
 * a different verb and leaves every checkout on disk.
 */
export const sessionCloseSchema = z.object({
  type: z.literal('session.close'),
  commandId: commandIdSchema,
  sessionId: sessionIdSchema,
  acceptUnpushedWork: z.boolean().default(false),
});

export type SessionCloseMessage = z.infer<typeof sessionCloseSchema>;

/**
 * Recreate window 0 in the same worktrees. This is what a host reboot needs: it
 * shows every session as stopped with a Restart button, and nothing about the
 * checkouts has changed.
 */
export const sessionRestartSchema = z.object({
  type: z.literal('session.restart'),
  commandId: commandIdSchema,
  sessionId: sessionIdSchema,
});

export type SessionRestartMessage = z.infer<typeof sessionRestartSchema>;

/** Re-read the host's tools and agents now, rather than waiting for a heartbeat. */
export const hostPreflightSchema = z.object({
  type: z.literal('host.preflight'),
  commandId: commandIdSchema,
});

export type HostPreflightMessage = z.infer<typeof hostPreflightSchema>;

/**
 * Install a release. The runner still fetches and verifies the signed manifest
 * itself — this asks, it does not hand over a binary, because the release is
 * signed by an offline key and not trusted because the control plane said so.
 */
export const hostUpdateSchema = z.object({
  type: z.literal('host.update'),
  commandId: commandIdSchema,
  version: z.string().min(1).max(64),
  channel: z.string().min(1).max(64),
});

export type HostUpdateMessage = z.infer<typeof hostUpdateSchema>;

/**
 * A short-lived repository token, sealed to the host's public key.
 *
 * One type, two directions, and the `grant` field says which: absent, this is
 * the runner asking for the installation token for one checkout's repository;
 * present, it is the control plane's answer. The token rides the link because
 * it is per session and the link is the only channel already authenticated per
 * host — a second HTTPS path would need a second auth story for nothing — and
 * it is sealed because a payload carrying a secret is encrypted to the runner's
 * key (F7), never readable off the relay.
 */
export const credentialsTokenSchema = z.object({
  type: z.literal('credentials.token'),
  requestId: commandIdSchema,
  sessionId: sessionIdSchema,
  checkoutId: checkoutIdSchema,
  githubRepoId: githubRepoIdSchema,
  grant: z
    .object({
      /** The token, sealed to the host's Ed25519 identity. Base64. */
      sealed: z.base64(),
      expiresAt: z.iso.datetime(),
    })
    .optional(),
});

export type CredentialsTokenMessage = z.infer<typeof credentialsTokenSchema>;

/** Drop a token before it expires — a repository left the installation, or the session ended. */
export const credentialsRevokeSchema = z.object({
  type: z.literal('credentials.revoke'),
  requestId: commandIdSchema,
  sessionId: sessionIdSchema,
  checkoutId: checkoutIdSchema,
});

export type CredentialsRevokeMessage = z.infer<typeof credentialsRevokeSchema>;

/* ------------------------------------------------------------------ the union */

/**
 * Every control message on the link, discriminated by `type`.
 *
 * The union spans both directions on purpose: one socket carries both, a
 * reconnect replays in both, and a single union is what lets one JSON Schema —
 * and one set of generated Go structs — describe the wire.
 */
export const protocolMessageSchema = z.discriminatedUnion('type', [
  helloSchema,
  heartbeatSchema,
  hintSchema,
  eventsAppendSchema,
  sessionCreateSchema,
  sessionAttachSchema,
  sessionInputSchema,
  sessionResizeSchema,
  sessionWindowOpenSchema,
  sessionWindowCloseSchema,
  sessionCloseSchema,
  sessionRestartSchema,
  hostPreflightSchema,
  hostUpdateSchema,
  credentialsTokenSchema,
  credentialsRevokeSchema,
]);

export type ProtocolMessage = z.infer<typeof protocolMessageSchema>;

/** Every `type` value in the union, for exhaustiveness checks and tests. */
export const PROTOCOL_MESSAGE_TYPES = [
  'hello',
  'heartbeat',
  'hint',
  'events.append',
  'session.create',
  'session.attach',
  'session.input',
  'session.resize',
  'session.window.open',
  'session.window.close',
  'session.close',
  'session.restart',
  'host.preflight',
  'host.update',
  'credentials.token',
  'credentials.revoke',
] as const;

export type ProtocolMessageType = (typeof PROTOCOL_MESSAGE_TYPES)[number];
