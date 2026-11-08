import { z } from 'zod/v4';
import { type HostCloudAgentId, isHostCloudAgent } from '../agents/catalog.js';
import { codexEnvironmentsListSchema, codexEnvironmentsSchema } from './codex-environments.js';
import {
  deviceAttachSchema,
  deviceDetachSchema,
  deviceInfoSchema,
  deviceInputSchema,
} from './devices.js';
import { hintSchema } from './hint.js';
import { CHAT_BATCH_MAX_ENTRIES, CHAT_ENTRY_MAX_BYTES } from './link.js';
import {
  portCloseSchema,
  portListingSchema,
  portListSchema,
  portOpenedSchema,
  portOpenSchema,
} from './ports.js';
import {
  attachmentIdSchema,
  checkoutIdSchema,
  codexEnvironmentRefSchema,
  commandIdSchema,
  githubRepoIdSchema,
  gitRefSchema,
  hostFactsSchema,
  hostPathSchema,
  launchOptionsSchema,
  promptTextSchema,
  protocolAgentSchema,
  protocolRangeSchema,
  sessionIdSchema,
  sessionSnapshotSchema,
  windowIndexSchema,
} from './primitives.js';
import {
  attachedFilesAreValid,
  SESSION_CREATE_MAX_FILES,
  SESSION_FILE_MEDIA_TYPES,
} from './session-file.js';
import { sharedPreviewGetSchema, sharedPreviewSchema } from './shared-files.js';
import { transcriptPageSchema, transcriptReadSchema } from './transcript.js';
import {
  whatsappAckSchema,
  whatsappLinkSchema,
  whatsappMessagesSchema,
  whatsappSendSchema,
  whatsappSentSchema,
  whatsappStateSchema,
  whatsappUnlinkSchema,
} from './whatsapp.js';

/**
 * The runner link's message vocabulary, as Zod — one source of truth, with JSON
 * Schema emitted from it (`pnpm --filter @oppenheimer/shared build`)
 * and the Go structs generated from that. This settles open question 1 of
 * `product/versions/mvp/01-protocol.md`: Zod is what this repo already uses for
 * DTOs, so the wire is not a second schema language.
 *
 * Only **control messages** are here. PTY bytes travel as binary frames — one
 * frame per PTY read, a 4-byte big-endian attachment id and then the bytes, no
 * JSON wrapping and no base64 — and nothing in this file describes them.
 */

/* ------------------------------------------------------------------ runner → control plane, and the ack */

/** What a runner can name in `hello.capabilities`. */
export const RUNNER_CAPABILITIES = [
  'session.image',
  'session.create.images',
  /**
   * Takes every type in `SESSION_FILE_MEDIA_TYPES` (PDF, text), not only the
   * images: a runner without it is sent images alone, on paste and at launch.
   */
  'session.files',
  'repository.prepare',
  /**
   * Answers `attachment.direct.offer`: an attachment may move from the link to
   * a WebRTC data channel with the browser (`product/versions/mvp/22-direct-terminal-path.md`).
   * Named only by a runner that drops a read-only attachment's input itself.
   */
  'attachment.direct',
  /**
   * Proves itself on every direct channel before a byte crosses it: it signs
   * both DTLS fingerprints and the browser's nonce with its host key
   * (`product/versions/mvp/31-peer-to-peer-and-the-host-proof.md`). The relay
   * invites a direct path only to a runner naming this beside
   * `attachment.direct`, because the console refuses a channel that is not
   * proved.
   */
  'attachment.direct.proof',
  /**
   * Takes a `session.create` with a `folder` instead of checkouts: a session in
   * a folder already on the host, nothing cloned and nothing written
   * (`product/versions/mvp/24-session-places.md`).
   */
  'session.folder',
  /** Answers `fs.list` with `fs.listing`: the folder picker's directories. */
  'fs.list',
  /** Answers `fs.find` with `fs.found`: the folder picker's search by name. */
  'fs.find',
  /**
   * Sends `attachment.chat` beside a coding agent session's PTY frames
   * (Claude Code, Codex, OpenCode, Grok): the agent's own transcript,
   * compacted, for the console's chat view (0.7). Each agent's is read into
   * the same lines, Claude Code's shape; OpenCode's off its API.
   */
  'attachment.chat',
  /**
   * Sends a Claude Code conversation tail first to an attachment whose
   * `session.attach` says `chatTail`: its `reset` carries the last turns and
   * `before`, the offset they start at, and `attachment.chat.older` is
   * answered with the turns before an offset
   * (`product/next-steps/0.7-terminal-and-chat.md`, "Tail first").
   */
  'attachment.chat.older',
  /**
   * Answers `device.attach`: the session has a simulator or emulator of its
   * own on this host, whose screen streams as JPEG frames and which takes
   * `device.input` (`product/research/device-streaming.md`).
   */
  'device.screen',
  /**
   * Answers `port.list` and `port.open`: the TCP ports a session's own
   * processes listen on, each reachable as an attachment of raw bytes, for the
   * console's Browser tab (`product/versions/mvp/30-session-previews.md`).
   */
  'port.forward',
  /**
   * Takes a `session.create` with `cloud`: the runner starts the task in
   * Claude Code's cloud (`claude --cloud`) from a checkout of the repository
   * and reports the cloud session's id, instead of opening a terminal
   * (`product/research/cloud-agents.md` §5B).
   */
  'session.cloud',
  /**
   * Takes a `session.create` with `cloud` for Codex: the runner starts the task
   * in Codex cloud (`codex cloud exec`) on the checkout's base branch, reports
   * the task's id, and from then on reads the task's status off
   * `codex cloud list --json` and reports it as the session's
   * (`product/next-steps/cloud-agents.md`).
   */
  'session.cloud.codex',
  /**
   * Takes a `session.create` whose launch names a cloud session to continue
   * (`launch.teleport`): the agent starts with `claude --teleport <id>` in the
   * new worktree, and a restart reopens that conversation with `--continue`.
   */
  'session.teleport',
  /**
   * Answers `codex.environments.list` with `codex.environments`: the Codex
   * cloud environments the host's ChatGPT account has, for the composer's
   * picker, and takes `session.create`'s `codexEnvironment`. A runner without
   * it guesses the environment from the repository's name.
   */
  'codex.environments',
  /**
   * Takes `session.watch` and `session.unwatch`: it scans a live session's
   * screen for a pattern on every pass it already makes, and reports a match
   * as a `terminal.matched` log entry carrying a count, never the text
   * (`product/versions/mvp/27-bot-subscriptions.md`).
   */
  'session.watch',
  /**
   * Holds a WhatsApp linked device for the owner: answers `whatsapp.link`,
   * `whatsapp.unlink` and `whatsapp.send`, and sends `whatsapp.state` and
   * `whatsapp.messages` (`product/next-steps/whatsapp.md`).
   */
  'whatsapp',
  /**
   * Logs `file.shared` for each file an agent shares, and answers
   * `shared.preview.get` with `shared.preview`: the JPEG preview it kept of
   * a shared image, for a bot to show (`product/next-steps/agent-tools.md` §7).
   */
  'shared.preview',
  /**
   * Answers `transcript.read` with `transcript.page`: a page of the session's
   * conversation, the chat view's entries, for a reader with no browser
   * attached (a bot, the CLI, an MCP client; `product/next-steps/agent-tools.md` §8).
   */
  'transcript.read',
  /**
   * Answers `host.exec` with `host.exec.result`: one program run to completion
   * for a bot, when this host's own exec policy lets it
   * (`product/versions/mvp/25-bots.md` §4.2, "Commands on a host").
   */
  'host.exec',
  /**
   * Answers `terminal.drive` with `terminal.screen`: a bot types into a
   * blank-terminal session's window and reads its screen back, when this
   * host's exec policy is `full` (`product/versions/mvp/25-bots.md` §4.2,
   * "Driving a terminal").
   */
  'terminal.drive',
] as const;
export type RunnerCapability = (typeof RUNNER_CAPABILITIES)[number];

/**
 * The capability a runner names to take a cloud session of each agent a host
 * starts in its vendor's cloud. A runner that named only `session.cloud`
 * predates Codex cloud and would refuse a Codex one.
 */
export const HOST_CLOUD_CAPABILITIES = {
  'claude-code': 'session.cloud',
  codex: 'session.cloud.codex',
} as const satisfies Record<HostCloudAgentId, RunnerCapability>;

/**
 * The capabilities a hello named that this side knows, in order. The hello
 * carries plain strings so a runner newer than its control plane (a rollback,
 * a staggered deploy) still links: what the control plane has never heard of
 * is dropped here rather than failing the whole hello.
 */
export function knownCapabilities(named: readonly string[]): RunnerCapability[] {
  return named.filter((name): name is RunnerCapability =>
    (RUNNER_CAPABILITIES as readonly string[]).includes(name),
  );
}

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
  /** A random id the runner mints at process start; event idempotency keys are `<runId>:<n>`. */
  runId: z.string().min(1).max(64),
  host: hostFactsSchema,
  /** Every session this host holds, however the control plane thinks they stand. */
  sessions: z.array(sessionSnapshotSchema),
  /**
   * Commands this runner takes beyond what every runner of its protocol
   * version does. The control plane sends one of these only to a runner that
   * named it, so an older runner is refused up front instead of logging a
   * frame it does not know while the console waits for a paste that never
   * comes. Absent is none.
   */
  /** Open-ended on purpose; read through `knownCapabilities`. */
  capabilities: z.array(z.string().min(1).max(64)).max(32).default([]),
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
   * a thinner summary: a second, narrower host-facts variant is how two
   * descriptions of one machine drift. A tool just installed, or a disk that has
   * filled, shows without waiting for a re-registration.
   */
  host: hostFactsSchema,
  load: z.object({
    /** One-minute load average, as the kernel reports it. Not part of `Facts`. */
    loadAverage1m: z.number().min(0),
    /** What a new process could have without swapping. Omitted where the runner cannot read it honestly. */
    memoryAvailableBytes: z.number().int().min(0).optional(),
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
   * the cap could only be a Zod `refine`, which does not survive emission. The
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
 * because the append is idempotent per key — `(sessionId, idempotencyKey)` is
 * unique, and keys already in the log are skipped — so a batch replayed after a
 * dropped ack, or cut off by a crash before it committed, appends only what was
 * not yet seen and the fold runs over exactly that.
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
 * Every path segment is an id or a unique-constrained column, so the runner
 * derives `<account>/<workspace>/sessions/<sessionSlug>/` without asking: the
 * account is the one it was paired with (`POST /hosts/register` answers it),
 * and the workspace travels here (24 §2). No project travels: a project is metadata, and nothing on a host is named after
 * it. `branch` is always the session's own — `oppenheimer/<session>`, or the
 * name its checkouts already recorded — created from each checkout's base and
 * never the base itself.
 */
export const sessionCreateSchema = z
  .object({
    type: z.literal('session.create'),
    commandId: commandIdSchema,
    sessionId: sessionIdSchema,
    organizationSlug: gitRefSchema,
    /**
     * The workspace the session is in. The runner names the work folder's
     * level under its account by it, `<account>/<workspace>/sessions/<sessionSlug>/`
     * (24 §2): an id, because a path never changes after it is made and a slug
     * can be edited. The account is not here: it is the pairing's.
     */
    workspaceId: z.uuid(),
    sessionSlug: gitRefSchema,
    agent: protocolAgentSchema,
    /**
     * How the agent is started: the model, the permission level and the effort
     * somebody chose in the composer's foot row; structured rather than argv
     * (`launchOptionsSchema` says why).
     *
     * The fold keeps them on the session so a restart reproduces the launch
     * (`product/versions/mvp/01-protocol.md`).
     */
    launch: launchOptionsSchema,
    /**
     * The person's first task, if the composer supplied one.
     *
     * The runner appends it to the agent's **argv** as the catalog's
     * `launch.prompt` says (`product/versions/mvp/02-runner.md` §5), rather than
     * sending a `session.input` after `session.started`: input needs the agent
     * up, a moment only the host can name.
     *
     * Set, the control plane has already written `prompt.first` to the log and
     * the runner writes nothing; unset, the runner reports the first message off
     * the transcript instead. The field is what decides which, so the two
     * writers never collide and never need a shared key (02 §7).
     */
    prompt: promptTextSchema.optional(),
    /**
     * The files attached to the first task in the composer (the field keeps
     * its first name; images, PDF and text since `session.files`). Like
     * `session.image`, the bytes are **not** here: the control plane parks each
     * under its `imageId` and the runner pulls it once over HTTPS
     * (`GET /hosts/self/images/{imageId}`) before it starts the agent, saves it
     * outside the worktree, and appends its path to `prompt` so the agent reads
     * it with the task (02 §7).
     *
     * Present only with a `prompt`, each named once (the refine below), and
     * sent only to a runner whose `hello` named `session.create.images`: an
     * older runner would drop the field and launch the task without the files.
     * A type beyond the images goes only to a runner that also named
     * `session.files`.
     */
    images: z
      .array(
        z.object({
          imageId: commandIdSchema,
          mediaType: z.enum(SESSION_FILE_MEDIA_TYPES),
        }),
      )
      .max(SESSION_CREATE_MAX_FILES)
      .optional(),
    /** The session's own branch. Present exactly when there are checkouts. */
    branch: gitRefSchema.optional(),
    /**
     * A folder session: the agent starts in this folder, which must already
     * exist on the host. Nothing is cloned, nothing written, and closing the
     * session only ends its terminal. Never with checkouts, and sent only to a
     * runner whose `hello` named `session.folder`.
     */
    folder: hostPathSchema.optional(),
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
    /**
     * A cloud session: the runner does not open a terminal. For Claude Code it
     * fetches the one checkout's repository with this token (minted for that
     * repository alone and sealed to the host, as `repository.prepare`'s is: a
     * credential ask names a live checkout, and a cloud session leaves none on
     * the host), checks out its base in a scratch directory, runs
     * `claude --cloud` there with `prompt` and removes the scratch directory.
     * For Codex it runs `codex cloud exec` on the checkout's base branch and
     * needs no checkout, so the token goes unused. Either way it reports the
     * cloud session's id on `session.started` (`agentSessionId`).
     *
     * Only with an agent of `HOST_CLOUD_AGENT_IDS`, one checkout and a prompt,
     * and sent only to a runner whose `hello` named `session.cloud` (Claude
     * Code) or `session.cloud.codex` (Codex).
     */
    cloud: z
      .object({
        /** The installation token, sealed to the host's Ed25519 identity. Base64. */
        sealed: z.base64(),
        expiresAt: z.iso.datetime(),
      })
      .optional(),
    /**
     * A Codex cloud session's environment, as the person picked it: its id
     * (or label), passed to `codex cloud exec --env`. Absent, the runner picks
     * the environment linked to the repository (`codex.environments`'
     * `recommended`) and then tries the repository's names as labels. Only on
     * a Codex cloud session, and sent only to a runner whose `hello` named
     * `codex.environments`.
     */
    codexEnvironment: codexEnvironmentRefSchema.optional(),
  })
  /** A session is in a folder or in its checkouts, never both and never neither. */
  .refine((message) => (message.folder === undefined) === message.checkouts.length > 0, {
    path: ['folder'],
  })
  .refine((message) => (message.branch !== undefined) === message.checkouts.length > 0, {
    path: ['branch'],
  })
  /** A cloud session starts Claude Code or Codex from one repository with a task. */
  .refine(
    (message) =>
      message.cloud === undefined ||
      (isHostCloudAgent(message.agent) &&
        message.checkouts.length === 1 &&
        message.prompt !== undefined),
    { path: ['cloud'] },
  )
  .refine(
    (message) =>
      message.codexEnvironment === undefined ||
      (message.cloud !== undefined && message.agent === 'codex'),
    { path: ['codexEnvironment'] },
  )
  .refine(
    (message) =>
      attachedFilesAreValid(
        message.prompt,
        message.images?.map((image) => image.imageId),
      ),
    { path: ['images'] },
  );

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
  /**
   * A watcher, not a typist: the host attaches tmux with `read-only,ignore-size`,
   * so the client can neither type into the pane nor resize it for the people
   * who can. The relay drops a read-only attachment's input as well; this is
   * the host's half of the same rule. Absent is a writer, as before.
   */
  readOnly: z.boolean().optional(),
  /**
   * The browser can ask for older turns and the relay will pass its asks
   * on, so the chat may be sent tail first (`attachment.chat.older`). Set
   * only for a runner that named that capability; absent, the whole history,
   * as before, so a runner newer than its control plane or console never
   * cuts a conversation nobody can scroll back through.
   */
  chatTail: z.boolean().optional(),
});

export type SessionAttachMessage = z.infer<typeof sessionAttachSchema>;

/**
 * Input the **control plane** originates for a window nobody is watching: the
 * composer's line on a session with no pane open, a scripted command. It is
 * not the interactive path — a browser's keystrokes are bare binary frames on
 * the attach socket and are relayed as binary frames on the link, under the
 * attachment id the relay allocated — which is why this is keyed by window and
 * carries no attachment.
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
 * A file for a window's prompt (an image, a PDF, text; the type keeps its
 * first name). The bytes are **not** here: control frames
 * stay small, and one paste must not queue ahead of every pane on the host.
 * The control plane parks the upload under this command id, and the runner
 * pulls it once over HTTPS with its own assertion
 * (`GET /hosts/self/images/{commandId}`), writes it outside the worktree, and
 * pastes its path into the window as a bracketed paste (02 §7).
 *
 * Sent only to a runner whose `hello` said it can take one (`session.image`),
 * and a type beyond the images only to one that named `session.files`.
 */
export const sessionImageSchema = z.object({
  type: z.literal('session.image'),
  commandId: commandIdSchema,
  sessionId: sessionIdSchema,
  window: windowIndexSchema,
  mediaType: z.enum(SESSION_FILE_MEDIA_TYPES),
});

export type SessionImageMessage = z.infer<typeof sessionImageSchema>;

/**
 * Replenish one attachment's flow-control window.
 *
 * The browser acks the bytes it has consumed, the control plane relays that
 * credit here, and the runner resumes the attachment's PTY reads. Without it a
 * pane that outruns its 256 KB window stalls for good; with it a runaway build
 * stalls its own pane, never the link
 * (`product/versions/mvp/01-protocol.md`, "Flow control and reconnect").
 *
 * The same shape on both hops (browser → control plane → runner). The credit is
 * a delta, never a running total: a lost frame then costs one window's worth of
 * throughput rather than desynchronising the counter.
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

/** How long a terminal watch's pattern may be. */
export const TERMINAL_WATCH_PATTERN_MAX = 200;

/**
 * Watch a live session's screen for a pattern (an RE2 regular expression,
 * matched line by line), replacing any watch with this `watchId` and another
 * pattern. The runner
 * scans the screen it already reads on each pass, and appends
 * `terminal.matched` (`{ watchId, count }`) to the session's log when lines it
 * had not matched before match: the first at once, then at most one entry per
 * 5 seconds, and at most 100 entries before it drops the watch. The matched
 * text never leaves the host. Kept in memory: the control plane sends its
 * watches again on every hello. An invalid pattern is `command.failed`
 * `INVALID_PATTERN`.
 */
export const sessionWatchSchema = z.object({
  type: z.literal('session.watch'),
  commandId: commandIdSchema,
  sessionId: sessionIdSchema,
  watchId: z.uuid(),
  pattern: z.string().min(1).max(TERMINAL_WATCH_PATTERN_MAX),
  /**
   * The count already reported for this watch, when the control plane sends
   * it again after the runner restarted: the runner counts on from it, so
   * its next report is past what the bot was told. A watch the runner still
   * holds with the same pattern is kept as it is.
   */
  count: z.number().int().min(0).optional(),
});

export type SessionWatchMessage = z.infer<typeof sessionWatchSchema>;

/** Stop a watch `session.watch` started; one the runner does not hold is no error. */
export const sessionUnwatchSchema = z.object({
  type: z.literal('session.unwatch'),
  commandId: commandIdSchema,
  sessionId: sessionIdSchema,
  watchId: z.uuid(),
});

export type SessionUnwatchMessage = z.infer<typeof sessionUnwatchSchema>;

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

/** Re-read the host's facts now, rather than waiting for the next heartbeat. */
export const hostPreflightSchema = z.object({
  type: z.literal('host.preflight'),
  commandId: commandIdSchema,
});

export type HostPreflightMessage = z.infer<typeof hostPreflightSchema>;

/**
 * Get a repository ready for a session that has not been asked for yet: clone
 * it (or fetch its base) and build the spare worktree a create then claims, so
 * the create that follows waits on neither. The console sends it the moment a
 * person picks a host and a repository in New session (02 §5, 05).
 *
 * Fire and forget: nothing is recorded and no session exists. The token the
 * clone needs travels **with** the command, minted for this repository alone
 * and sealed to the host's key as `credentials.grant` seals one, because a
 * credential ask names a session and there is none. It is used for this
 * command's git and dropped when it ends.
 */
export const repositoryPrepareSchema = z.object({
  type: z.literal('repository.prepare'),
  commandId: commandIdSchema,
  /**
   * Whose stores to warm: the work folder's `<account>/<workspace>/repos/`
   * (24 §2), the account being the one the runner was paired with.
   */
  workspaceId: z.uuid(),
  githubRepoId: githubRepoIdSchema,
  repositoryFullName: gitRefSchema,
  baseBranch: gitRefSchema,
  /** The installation token, sealed to the host's Ed25519 identity. Base64. */
  sealed: z.base64(),
  expiresAt: z.iso.datetime(),
});

export type RepositoryPrepareMessage = z.infer<typeof repositoryPrepareSchema>;

/**
 * List one directory on the host, for the folder picker (24 §4). Absent `path`
 * is the home directory of the user the runner runs as. Sent only to a runner
 * whose `hello` named `fs.list`; answered by `fs.listing` with the same
 * `commandId`, or by `command.failed` (`FS_001` not found, `FS_002` not a
 * directory, `FS_003` not readable).
 */
export const fsListSchema = z.object({
  type: z.literal('fs.list'),
  commandId: commandIdSchema,
  path: hostPathSchema.optional(),
});

export type FsListMessage = z.infer<typeof fsListSchema>;

/** How many directories one `fs.listing` names at most. */
export const FS_LISTING_MAX_ENTRIES = 500;

/** The shortest name `fs.find` searches for: one letter matches nearly everything. */
export const FS_FIND_MIN_QUERY = 2;

/** How many levels under its `path` `fs.find` walks. */
export const FS_FIND_MAX_DEPTH = 4;

/**
 * A directory's sub-directories: names only, never files and never contents.
 * Hidden ones are left out. A sub-directory that is a git repository carries
 * the branch its checkout is on.
 */
export const fsListingSchema = z.object({
  type: z.literal('fs.listing'),
  commandId: commandIdSchema,
  /** The directory listed, absolute and cleaned. */
  path: hostPathSchema,
  /** Its parent, or null at the root. */
  parent: hostPathSchema.nullable(),
  /** The home directory, so the picker can show `~`. */
  home: hostPathSchema,
  /** The listed directory's own branch, when it is a repository. */
  branch: z.string().min(1).max(255).optional(),
  entries: z
    .array(
      z.object({
        name: z.string().min(1).max(255),
        branch: z.string().min(1).max(255).optional(),
      }),
    )
    .max(FS_LISTING_MAX_ENTRIES),
  /** More directories were there than `entries` carries. */
  truncated: z.boolean().optional(),
});

export type FsListingMessage = z.infer<typeof fsListingSchema>;

/** The most arguments one `host.exec` carries, the program included. */
export const HOST_EXEC_MAX_ARGS = 64;

/** The longest one argument may be, in characters. */
export const HOST_EXEC_MAX_ARG_LENGTH = 8_192;

/** How long a run may last when `host.exec` names no timeout, in seconds. */
export const HOST_EXEC_DEFAULT_TIMEOUT_SECONDS = 60;

/** The longest a run may last, in seconds. */
export const HOST_EXEC_MAX_TIMEOUT_SECONDS = 600;

/** How many bytes of each stream `host.exec.result` keeps: the last ones. */
export const HOST_EXEC_OUTPUT_MAX_BYTES = 32_768;

/**
 * Run one program on the host for a bot, to completion
 * (`product/versions/mvp/25-bots.md` §4.2, "Commands on a host").
 *
 * `argv` is the program and its arguments, run directly, never through a
 * shell: a pipe or a `;` is an argument like any other, so the host's policy
 * decides on the program that actually runs. The policy is the host's own
 * (`runner exec`), read on every call: `off` (the default) refuses everything,
 * `allowlist` runs only the programs it names, `full` runs anything. The
 * control plane never sees or changes it.
 *
 * The run starts in `cwd` when given, otherwise in the bot's own folder under
 * the host's workspaces (`bots/<home>`), which the runner creates and keeps.
 * Stdin is empty. Sent only to a runner whose `hello` named `host.exec`;
 * answered by `host.exec.result` with the same `commandId`, or by
 * `command.failed` (`EXEC_001` exec is off on this host, `EXEC_002` the program
 * is not allowed, `EXEC_003` the folder is not usable, `EXEC_004` the program
 * could not be started).
 */
export const hostExecSchema = z.object({
  type: z.literal('host.exec'),
  commandId: commandIdSchema,
  argv: z.array(z.string().min(1).max(HOST_EXEC_MAX_ARG_LENGTH)).min(1).max(HOST_EXEC_MAX_ARGS),
  cwd: hostPathSchema.optional(),
  /** The bot's own folder's name: lowercase letters, digits and dashes. */
  home: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*$/),
  timeoutSeconds: z.number().int().min(1).max(HOST_EXEC_MAX_TIMEOUT_SECONDS),
});

export type HostExecMessage = z.infer<typeof hostExecSchema>;

/**
 * How a `host.exec` run ended. `exitCode` is null when the program did not
 * exit on its own: it ran past its timeout (`timedOut`) and its whole process
 * group was killed, or a signal ended it. Each stream keeps its last
 * `HOST_EXEC_OUTPUT_MAX_BYTES` bytes, with `*Truncated` saying more was there.
 */
export const hostExecResultSchema = z.object({
  type: z.literal('host.exec.result'),
  commandId: commandIdSchema,
  exitCode: z.number().int().nullable(),
  timedOut: z.boolean(),
  stdout: z.string(),
  stderr: z.string(),
  stdoutTruncated: z.boolean().optional(),
  stderrTruncated: z.boolean().optional(),
  /** Where it ran, absolute and cleaned. */
  cwd: hostPathSchema,
  durationMs: z.number().int().min(0),
});

export type HostExecResultMessage = z.infer<typeof hostExecResultSchema>;

/**
 * The keys `terminal.drive` may press after its text, by tmux's own names:
 * the ones a person needs to run and leave programs in a shell.
 */
export const TERMINAL_KEYS = [
  'Enter',
  'Tab',
  'Escape',
  'BSpace',
  'Space',
  'Up',
  'Down',
  'Left',
  'Right',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'C-c',
  'C-d',
  'C-z',
  'C-l',
  'C-a',
  'C-e',
  'C-r',
  'C-u',
  'C-w',
] as const;

/** The most text one `terminal.drive` types. */
export const TERMINAL_TEXT_MAX = 8_192;

/** The longest `terminal.drive` waits for its pattern or for quiet, in seconds. */
export const TERMINAL_WAIT_MAX_SECONDS = 60;

/** How many lines above the visible screen `terminal.drive` may read back. */
export const TERMINAL_HISTORY_MAX_LINES = 500;

/**
 * Type into a blank-terminal session (agent `shell`) and read its screen
 * back, for a bot (`product/versions/mvp/25-bots.md` §4.2, "Driving a
 * terminal"). In order: `text` is typed literally (never read as key names),
 * then each of `keys` is pressed, then the runner waits: until `waitFor` (an
 * RE2 pattern) matches a line of the screen, or for `waitSeconds` when no
 * pattern is given, at most `TERMINAL_WAIT_MAX_SECONDS`; then it captures the
 * visible screen and `history` lines above it. A drive with no text and no
 * keys only reads.
 *
 * The host decides: only a host whose exec policy is `full` takes it, since
 * a shell runs anything. Sent only to a runner whose `hello` named
 * `terminal.drive`; answered by `terminal.screen` with the same `commandId`,
 * or by `command.failed` (`EXEC_006` the host's policy is not `full`,
 * `EXEC_007` the session is not a blank terminal, `SESS_001` not on this
 * host, `INVALID_PATTERN`).
 */
export const terminalDriveSchema = z.object({
  type: z.literal('terminal.drive'),
  commandId: commandIdSchema,
  sessionId: sessionIdSchema,
  window: windowIndexSchema.optional(),
  text: z.string().max(TERMINAL_TEXT_MAX).optional(),
  keys: z.array(z.enum(TERMINAL_KEYS)).max(32).optional(),
  waitFor: z.string().min(1).max(TERMINAL_WATCH_PATTERN_MAX).optional(),
  waitSeconds: z.number().int().min(0).max(TERMINAL_WAIT_MAX_SECONDS),
  history: z.number().int().min(0).max(TERMINAL_HISTORY_MAX_LINES).optional(),
});

export type TerminalDriveMessage = z.infer<typeof terminalDriveSchema>;

/**
 * What a `terminal.drive` left on the screen. `matched` says whether its
 * `waitFor` matched before the wait ran out (false when it gave none).
 * `screen` is the captured text, its last `TERMINAL_SCREEN_MAX_BYTES` kept.
 */
export const terminalScreenSchema = z.object({
  type: z.literal('terminal.screen'),
  commandId: commandIdSchema,
  screen: z.string(),
  matched: z.boolean(),
  waitedMs: z.number().int().min(0),
});

export type TerminalScreenMessage = z.infer<typeof terminalScreenSchema>;

/** How much of a captured screen `terminal.screen` carries: the last bytes. */
export const TERMINAL_SCREEN_MAX_BYTES = 32_768;

/**
 * Find folders under one directory by name, for the folder picker's search
 * (24 §4): a bounded walk, at most `FS_FIND_MAX_DEPTH` levels down, that skips
 * hidden directories and dependency trees and never descends into a git
 * repository, so a repository is found and its insides are not. Absent `path`
 * is the home directory. Sent only to a runner whose `hello` named `fs.find`;
 * answered by `fs.found` with the same `commandId`, or by `command.failed`
 * with the `fs.list` codes for `path`.
 */
export const fsFindSchema = z.object({
  type: z.literal('fs.find'),
  commandId: commandIdSchema,
  /** Matched against each directory's name, without regard to case. */
  query: z.string().min(FS_FIND_MIN_QUERY).max(255),
  path: hostPathSchema.optional(),
});

export type FsFindMessage = z.infer<typeof fsFindSchema>;

/** How many folders one `fs.found` names at most. */
export const FS_FIND_MAX_RESULTS = 50;

/**
 * The folders whose name holds the query, best first: a name that is the
 * query, then one that starts with it, then the rest, each shallower first.
 * `truncated` says the walk stopped at its budget, so a folder further away
 * may exist.
 */
export const fsFoundSchema = z.object({
  type: z.literal('fs.found'),
  commandId: commandIdSchema,
  /** The directory searched under, absolute and cleaned. */
  path: hostPathSchema,
  home: hostPathSchema,
  entries: z
    .array(
      z.object({
        path: hostPathSchema,
        branch: z.string().min(1).max(255).optional(),
      }),
    )
    .max(FS_FIND_MAX_RESULTS),
  truncated: z.boolean().optional(),
});

export type FsFoundMessage = z.infer<typeof fsFoundSchema>;

/**
 * Install a release. The runner still fetches and verifies the signed manifest
 * itself — this asks, it does not hand over a binary, because the release is
 * signed by an offline key and not trusted because the control plane said so.
 *
 * `version` pins the host to that release; absent, the runner installs the
 * newest its channel offers now, skipping the safe window, and stays unpinned,
 * and a host already pinned refuses rather than leave its pin. The console's
 * Update runner sends it absent.
 */
export const hostUpdateSchema = z.object({
  type: z.literal('host.update'),
  commandId: commandIdSchema,
  version: z.string().min(1).max(64).optional(),
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
  /**
   * The reconnect generation, allocated by the control plane per accepted link
   * on this host and bumped on every one. Both peers use this number: the
   * runner drops frames and callbacks from an older epoch, the control plane
   * closes the older socket — so a log line on either side names the same link.
   */
  epoch: z.number().int().min(1),
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

/* ------------------------------------------------------------------ the direct path (22) */

/**
 * An SDP blob, offer or answer, with every ICE candidate in it (no trickle).
 * A fresh schema per use: one shared instance becomes an unnamed `$defs` entry.
 */
const sdp = () =>
  z
    .string()
    .min(1)
    .max(16 * 1024);

/**
 * The control plane hands the runner a browser's offer for one attachment it
 * already holds. The runner answers with `attachment.direct.answer` or refuses
 * with `attachment.direct.refused`; either way the attachment keeps streaming
 * on the link until a data channel opens. Sent only to a runner that named the
 * `attachment.direct` capability.
 */
export const attachmentDirectOfferSchema = z.object({
  type: z.literal('attachment.direct.offer'),
  attachmentId: attachmentIdSchema,
  sdp: sdp(),
  /** STUN/TURN URLs the runner gathers candidates with; empty means host candidates only. */
  iceServers: z.array(z.string().min(1).max(256)).max(8).default([]),
});

export type AttachmentDirectOfferMessage = z.infer<typeof attachmentDirectOfferSchema>;

/** The runner's answer, with its candidates gathered. */
export const attachmentDirectAnswerSchema = z.object({
  type: z.literal('attachment.direct.answer'),
  attachmentId: attachmentIdSchema,
  sdp: sdp(),
});

export type AttachmentDirectAnswerMessage = z.infer<typeof attachmentDirectAnswerSchema>;

/** The runner will not open a direct path for this attachment; it stays on the link. */
export const attachmentDirectRefusedSchema = z.object({
  type: z.literal('attachment.direct.refused'),
  attachmentId: attachmentIdSchema,
  reason: z.string().max(200),
});

export type AttachmentDirectRefusedMessage = z.infer<typeof attachmentDirectRefusedSchema>;

/**
 * Where one direction of an attachment moves to its data channel, as a byte
 * offset into that direction's stream. From the runner it is the output: every
 * PTY byte after `offset` travels on the channel, and the browser reads the
 * relay until it holds `offset` bytes from it. From the control plane it is
 * the input, the browser's count of keystroke bytes it sent on the relay. An
 * offset rather than a marker because the link sends control frames ahead of
 * queued PTY frames, so a marker could overtake the bytes it stands behind.
 */
export const attachmentPathSchema = z.object({
  type: z.literal('attachment.path'),
  attachmentId: attachmentIdSchema,
  offset: z.number().int().min(0),
});

export type AttachmentPathMessage = z.infer<typeof attachmentPathSchema>;

/* ------------------------------------------------------------------ the chat view (0.7) */

/**
 * Entries of a session's agent transcript, for the chat view beside the
 * terminal (`product/next-steps/0.7-terminal-and-chat.md`). The agent still
 * runs in tmux, unmodified, and the terminal is still its interface: this is a
 * second reading of the same conversation, from the file the CLI writes, not a
 * way of driving it.
 *
 * Each entry is one transcript line, compacted on the host and kept as the
 * JSON string it is, because the transcript's shape is the CLI's and changes
 * with its versions: the console reads it, the link only carries it. The
 * first message for an attachment carries `reset` and the history so far;
 * later ones carry what was appended since. Sent only by a runner that named
 * `attachment.chat`, and only while the attachment is open.
 */
export const attachmentChatSchema = z.object({
  type: z.literal('attachment.chat'),
  attachmentId: attachmentIdSchema,
  reset: z.boolean().optional(),
  /**
   * Where the history a `reset` started stands: `more` on each of its
   * batches while more of it is on its way, `end` on the one that reaches
   * the transcript's end, absent on what follows live. A runner that sends
   * neither leaves the console to infer the end from the batches' size and
   * pace, which a slow read (a screenshot's preview) defeats.
   */
  history: z.enum(['more', 'end']).optional(),
  /**
   * Where in the transcript what this attachment has sent starts, as a byte
   * offset: on the batch that carries `reset`, and on the last batch of an
   * older page. Absent, or 0, is the conversation from its first line, with
   * nothing older to ask for (`attachment.chat.older`).
   */
  before: z.number().int().nonnegative().optional(),
  /**
   * The batch is part of a page of older turns asked for with
   * `attachment.chat.older`, not what follows live: `more` while the page is
   * still coming, `end` on its last batch, which carries `before`.
   */
  older: z.enum(['more', 'end']).optional(),
  entries: z.array(z.string().min(1).max(CHAT_ENTRY_MAX_BYTES)).max(CHAT_BATCH_MAX_ENTRIES),
});

export type AttachmentChatMessage = z.infer<typeof attachmentChatSchema>;

/**
 * Asks for the turns of an attachment's conversation before `before`, the
 * offset the console holds it from: the reader scrolled to the top of the
 * chat. Answered with `attachment.chat` batches marked `older`. Sent only to
 * a runner that named `attachment.chat.older`.
 */
export const attachmentChatOlderSchema = z.object({
  type: z.literal('attachment.chat.older'),
  attachmentId: attachmentIdSchema,
  before: z.number().int().positive(),
});

export type AttachmentChatOlderMessage = z.infer<typeof attachmentChatOlderSchema>;

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
  sessionImageSchema,
  attachmentCreditSchema,
  sessionResizeSchema,
  sessionWindowOpenSchema,
  sessionWindowCloseSchema,
  sessionCloseSchema,
  sessionWatchSchema,
  sessionUnwatchSchema,
  sessionStopSchema,
  sessionRestartSchema,
  hostPreflightSchema,
  hostUpdateSchema,
  credentialsTokenSchema,
  credentialsGrantSchema,
  credentialsRevokeSchema,
  repositoryPrepareSchema,
  fsListSchema,
  fsListingSchema,
  fsFindSchema,
  fsFoundSchema,
  hostExecSchema,
  hostExecResultSchema,
  terminalDriveSchema,
  terminalScreenSchema,
  attachmentDirectOfferSchema,
  attachmentDirectAnswerSchema,
  attachmentDirectRefusedSchema,
  attachmentPathSchema,
  attachmentChatSchema,
  attachmentChatOlderSchema,
  deviceAttachSchema,
  deviceInfoSchema,
  deviceInputSchema,
  deviceDetachSchema,
  portListSchema,
  portListingSchema,
  portOpenSchema,
  portOpenedSchema,
  portCloseSchema,
  codexEnvironmentsListSchema,
  codexEnvironmentsSchema,
  whatsappLinkSchema,
  whatsappUnlinkSchema,
  whatsappStateSchema,
  whatsappMessagesSchema,
  whatsappAckSchema,
  whatsappSendSchema,
  whatsappSentSchema,
  sharedPreviewGetSchema,
  sharedPreviewSchema,
  transcriptReadSchema,
  transcriptPageSchema,
]);

export type ProtocolMessage = z.infer<typeof protocolMessageSchema>;

/**
 * Every `type` value the union carries.
 *
 * **Derived, never listed.** The type comes off `ProtocolMessage` and the values
 * come off the union's own members, so a message added above cannot land in one
 * place and not the other.
 */
export type ProtocolMessageType = ProtocolMessage['type'];

export const PROTOCOL_MESSAGE_TYPES: readonly ProtocolMessageType[] =
  protocolMessageSchema.options.map((member) => member.shape.type.value);
