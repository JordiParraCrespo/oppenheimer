import { z } from 'zod/v4';
import { hintSchema } from './hint';
import {
  attachmentIdSchema,
  checkoutIdSchema,
  commandIdSchema,
  githubRepoIdSchema,
  gitRefSchema,
  hostFactsSchema,
  launchOptionsSchema,
  promptTextSchema,
  protocolAgentSchema,
  protocolRangeSchema,
  sessionIdSchema,
  sessionSnapshotSchema,
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
  /** The update channel this host follows, so the control plane can offer the right release. */
  channel: z.string().min(1).max(64),
  /**
   * The host's facts, re-read — **the same `Facts` shape registration sends**, not
   * a thinner summary of it.
   *
   * This carries `tools`, `diskFreeBytes` and `runnerVersion`, which is why the
   * heartbeat no longer has its own copies of those three: a second, narrower
   * host-facts variant here is how the two descriptions of one machine drift. A
   * tool the person has just installed, or a disk that has filled, becomes visible
   * without waiting for a re-registration.
   */
  host: hostFactsSchema,
  load: z.object({
    /** One-minute load average, as the kernel reports it. Not part of `Facts`. */
    loadAverage1m: z.number().min(0),
  }),
  sessions: z.array(sessionSnapshotSchema),
});

export type HeartbeatMessage = z.infer<typeof heartbeatSchema>;

/** The cap on one event's payload. It never carries pane text: PTY bytes never reach Postgres. */
export const PROTOCOL_MAX_EVENT_PAYLOAD_BYTES = 8 * 1024;

/**
 * `<runId>:<n>` — the writer's own idempotency key. It depends on nothing the
 * control plane hands out, so it survives any reconnect, and it is what the
 * acknowledgement below names a row by.
 */
export const eventIdempotencyKeySchema = z
  .string()
  .min(3)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+:\d+$/);

z.globalRegistry.add(eventIdempotencyKeySchema, { id: 'eventIdempotencyKey' });

/**
 * One entry for a session's append-only log, which is the truth per session.
 *
 * `seq` is absent on purpose: it is assigned by the **control plane** under a
 * row lock, so a buggy or hostile host cannot create gaps or regress the log.
 */
export const sessionEventSchema = z.object({
  idempotencyKey: eventIdempotencyKeySchema,
  kind: z.string().min(1).max(64),
  /**
   * The event's payload, as a **JSON string** rather than an object.
   *
   * That is what makes the 8 KB cap real in both languages: `maxLength` on a
   * string survives the trip to JSON Schema, so the generated Go refuses an
   * oversized payload exactly where the control plane does. As a nested object
   * the cap could only be a Zod `refine`, which does not survive emission at all
   * — leaving the runner and the API to disagree about the limit on day two. The
   * control plane parses this and stores jsonb; the wire carries text.
   */
  payload: z.string().max(PROTOCOL_MAX_EVENT_PAYLOAD_BYTES),
  occurredAt: z.iso.datetime(),
});

export type SessionEvent = z.infer<typeof sessionEventSchema>;

/**
 * A batch for one session's log. The append and the fold happen in one
 * transaction, so the sidebar is never eventually-consistent with its own log.
 *
 * `batchId` exists because a WebSocket cannot tell "persisted before the
 * disconnect" from "never arrived". The handshake is therefore explicit: the
 * runner keeps a batch until an `events.ack` naming this `batchId` accounts for
 * every key in it, and resends the batch otherwise. A resend is harmless
 * because the append is one
 * `INSERT … ON CONFLICT (sessionId, idempotencyKey) DO NOTHING` per row, so a
 * batch replayed after a dropped ack, or half-applied before a crash, appends
 * only what was not yet seen and the fold runs over exactly that.
 */
export const eventsAppendSchema = z.object({
  type: z.literal('events.append'),
  batchId: z.string().min(1).max(64),
  sessionId: sessionIdSchema,
  events: z.array(sessionEventSchema).min(1).max(256),
});

export type EventsAppendMessage = z.infer<typeof eventsAppendSchema>;

/**
 * The control plane's answer to one `events.append`, and the only thing that
 * lets a runner drop a batch from memory.
 *
 * `accepted` lists the keys now durable — the rows that landed *and* the rows a
 * previous attempt had already landed, since `DO NOTHING` makes those
 * indistinguishable and both mean "stop resending this". A key in neither list
 * was not accounted for, so the runner resends the batch.
 */
export const eventsAckSchema = z.object({
  type: z.literal('events.ack'),
  batchId: z.string().min(1).max(64),
  accepted: z.array(eventIdempotencyKeySchema),
  /**
   * Keys the control plane refuses and the runner must not resend — an
   * oversized payload, an unknown kind, a session it no longer owns. Absent
   * means nothing was refused.
   */
  rejected: z
    .array(
      z.object({
        idempotencyKey: eventIdempotencyKeySchema,
        reason: z.string().min(1).max(200),
      }),
    )
    .optional(),
});

export type EventsAckMessage = z.infer<typeof eventsAckSchema>;

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
  organizationSlug: gitRefSchema,
  projectSlug: gitRefSchema,
  sessionSlug: gitRefSchema,
  agent: protocolAgentSchema,
  /**
   * How the agent is started: the model, the permission level and the effort
   * somebody chose in the composer's foot row. Structured rather than argv —
   * the host owns the mapping to its own flags, from the same catalog
   * (`launchOptionsSchema`).
   *
   * It replaces the bare `model` this message carried while a model was the
   * only launch option there was; the three travel together now, and the fold
   * keeps them on the session so a restart reproduces the launch
   * (`product/versions/mvp/01-protocol.md`).
   */
  launch: launchOptionsSchema,
  /**
   * The person's first task, if the composer supplied one.
   *
   * The runner appends it to the agent's **argv** — both CLIs document the
   * first task as a trailing positional, and the catalog's `launch.prompt`
   * says how (`product/versions/mvp/02-runner.md` §5). So it rides the launch
   * rather than arriving as a `session.input` after `session.started`: input
   * needs the agent up, and "the agent is up" is a moment only the host can
   * name. In argv there is nothing to synchronise.
   *
   * Set, the control plane has already written `prompt.first` to the log and
   * the runner writes nothing; unset, the runner reports the first message off
   * the transcript instead. The field is what decides which, so the two
   * writers never collide and never need a shared key (02 §7).
   */
  prompt: promptTextSchema.optional(),
  branch: gitRefSchema,
  checkouts: z.array(
    z.object({
      checkoutId: checkoutIdSchema,
      githubRepoId: githubRepoIdSchema,
      repositoryFullName: gitRefSchema,
      /** Never reused inside a session: a retired name would inherit a stranger's history. */
      directoryName: gitRefSchema,
      baseBranch: gitRefSchema,
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

/**
 * Replenish one attachment's flow-control window.
 *
 * The browser acks the bytes it has consumed, the control plane relays that
 * credit here, and the runner resumes the attachment's PTY reads. Without it a
 * pane that outruns its 256 KB window stalls for good rather than briefly, so
 * this is the message that makes "a runaway build stalls its own pane, never the
 * link" true instead of aspirational
 * (`product/versions/mvp/01-protocol.md`, "Flow control and reconnect").
 *
 * It is the same shape in both places it is used: the browser sends it to the
 * control plane for its one attachment, and the control plane sends it on to the
 * runner. The credit is a delta, never a running total — a lost frame then costs
 * one window's worth of throughput rather than desynchronising the counter.
 */
export const attachmentCreditSchema = z.object({
  type: z.literal('attachment.credit'),
  attachmentId: attachmentIdSchema,
  /** Bytes the consumer has drained since its last credit. */
  bytes: z.number().int().positive(),
});

export type AttachmentCreditMessage = z.infer<typeof attachmentCreditSchema>;

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
/**
 * End the agent and the tmux session and leave every checkout on disk, which
 * is what makes Restart possible afterwards (02 §5: "Stop is not close").
 */
export const sessionStopSchema = z.object({
  type: z.literal('session.stop'),
  commandId: commandIdSchema,
  sessionId: sessionIdSchema,
});

export type SessionStopMessage = z.infer<typeof sessionStopSchema>;

export const sessionRestartSchema = z.object({
  type: z.literal('session.restart'),
  commandId: commandIdSchema,
  sessionId: sessionIdSchema,
});

export type SessionRestartMessage = z.infer<typeof sessionRestartSchema>;

/** Re-read the host's facts now, rather than waiting for the next heartbeat. */
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
 * The runner asking for the installation token for one checkout's repository.
 *
 * It rides the link because the token is per session and the link is the only
 * channel already authenticated per host; a second HTTPS path would need a
 * second auth story for nothing.
 */
export const credentialsTokenSchema = z.object({
  type: z.literal('credentials.token'),
  requestId: commandIdSchema,
  sessionId: sessionIdSchema,
  checkoutId: checkoutIdSchema,
  githubRepoId: githubRepoIdSchema,
});

export type CredentialsTokenMessage = z.infer<typeof credentialsTokenSchema>;

/**
 * The control plane's answer, with the token **sealed to the host's public key**
 * (F7) so it is never readable off the relay.
 *
 * This is its own type rather than an optional field on the ask. An optional
 * `grant` as a direction flag means every handler branches on `grant == null`,
 * the generated Go gets a pointer, and a confused peer can send a grant on a
 * request or a request shaped like a grant. Both fields here are required,
 * because a grant without them is not a grant.
 */
export const credentialsGrantSchema = z.object({
  type: z.literal('credentials.grant'),
  requestId: commandIdSchema,
  sessionId: sessionIdSchema,
  checkoutId: checkoutIdSchema,
  /** The token, sealed to the host's Ed25519 identity. Base64. */
  sealed: z.base64(),
  expiresAt: z.iso.datetime(),
});

export type CredentialsGrantMessage = z.infer<typeof credentialsGrantSchema>;

/** Drop a token before it expires — a repository left the installation, or the session ended. */
export const credentialsRevokeSchema = z.object({
  type: z.literal('credentials.revoke'),
  requestId: commandIdSchema,
  sessionId: sessionIdSchema,
  checkoutId: checkoutIdSchema,
});

export type CredentialsRevokeMessage = z.infer<typeof credentialsRevokeSchema>;

/* ------------------------------------------------------------------ handshake and outcomes */

/**
 * The control plane's answer to `hello`, and the first thing the runner reads
 * after sending it. It carries the protocol version the two will speak and the
 * fingerprint of the control plane's signing key, which the runner compares
 * against the one it pinned at registration and refuses on mismatch (01 F6).
 * A runner below `min_supported` never receives this: it is refused with an
 * `update_required` hint instead.
 */
export const welcomeSchema = z.object({
  type: z.literal('welcome'),
  protocol: z.number().int().min(1),
  keyFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  /** The link's own view of the host, so the runner can log what it is known as. */
  hostId: z.string().min(1).max(64),
});

export type WelcomeMessage = z.infer<typeof welcomeSchema>;

/**
 * The runner refused or could not carry out a command. Success is never
 * reported this way — a created session says so with `session.started` in the
 * log, an attachment says so with its first frame — because a command's success
 * is a fact about the session and belongs in its log, while a failure to even
 * try is a fact about this one delivery, which is all a link reply can be.
 */
export const commandFailedSchema = z.object({
  type: z.literal('command.failed'),
  commandId: commandIdSchema,
  /** A catalog code (`SESS_003`, `TMUX_001`), so the console can render it. */
  code: z.string().min(1).max(32),
  detail: z.string().max(500).optional(),
});

export type CommandFailedMessage = z.infer<typeof commandFailedSchema>;

/**
 * The control plane frees an attachment: the browser went away, or the relay
 * is closing. The runner stops the PTY reads and forgets the id; a frame for it
 * that is already in flight is dropped by the receiver.
 */
export const sessionDetachSchema = z.object({
  type: z.literal('session.detach'),
  commandId: commandIdSchema,
  sessionId: sessionIdSchema,
  attachmentId: attachmentIdSchema,
});

export type SessionDetachMessage = z.infer<typeof sessionDetachSchema>;

/**
 * The runner's side of the same fact: the PTY behind an attachment ended
 * (the window closed, tmux exited, the session was killed), so the id is free.
 */
export const attachmentClosedSchema = z.object({
  type: z.literal('attachment.closed'),
  attachmentId: attachmentIdSchema,
  reason: z.string().max(200).optional(),
});

export type AttachmentClosedMessage = z.infer<typeof attachmentClosedSchema>;

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
  welcomeSchema,
  commandFailedSchema,
  sessionDetachSchema,
  attachmentClosedSchema,
  eventsAppendSchema,
  eventsAckSchema,
  sessionCreateSchema,
  sessionAttachSchema,
  sessionInputSchema,
  attachmentCreditSchema,
  sessionResizeSchema,
  sessionWindowOpenSchema,
  sessionWindowCloseSchema,
  sessionCloseSchema,
  sessionStopSchema,
  sessionRestartSchema,
  hostPreflightSchema,
  hostUpdateSchema,
  credentialsTokenSchema,
  credentialsGrantSchema,
  credentialsRevokeSchema,
]);

export type ProtocolMessage = z.infer<typeof protocolMessageSchema>;

/**
 * Every `type` value the union carries.
 *
 * **Derived, never listed.** The type comes off `ProtocolMessage` and the values
 * come off the union's own members, so a message added above cannot land in one
 * place and not the other — which is exactly how a hand-written twin of this
 * list would drift.
 */
export type ProtocolMessageType = ProtocolMessage['type'];

export const PROTOCOL_MESSAGE_TYPES: readonly ProtocolMessageType[] =
  protocolMessageSchema.options.map((member) => member.shape.type.value);
