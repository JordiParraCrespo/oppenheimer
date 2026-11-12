import { z } from 'zod';

/**
 * A Claude Code cloud session's chat in the console
 * (`product/next-steps/cloud-agents.md`, "The chat of a cloud session"): two
 * hooks in the session send its transcript here and collect the replies typed
 * in the console, and the console reads both.
 */

/**
 * A cloud session's id as either side names it: Claude Code hands its hooks
 * `cse_…` (`CLAUDE_CODE_REMOTE_SESSION_ID`), claude.ai and the console say
 * `session_…` with the same suffix. Read once here, as the console's.
 */
export const cloudSessionRefSchema = z
  .string()
  .regex(/^(cse|session)_[A-Za-z0-9]{8,64}$/)
  .transform((value) => value.replace(/^cse_/, 'session_'));

/** Lines one append may carry: a long history arrives as several. */
export const MAX_CLOUD_TRANSCRIPT_BATCH = 200;
/**
 * One transcript line, at most: under the API's request body limit with room
 * for a few beside it. A tool's output can run past it, so the hook shortens
 * a line's long strings before it sends it (the chat clips them anyway).
 */
export const MAX_CLOUD_TRANSCRIPT_LINE_BYTES = 64_000;

/**
 * `POST /sessions/cloud-transcript`, from the session's SessionStart hook: the
 * transcript's lines from `from` on, each as Claude Code wrote it. Sent again
 * after a failure, so the lines are numbered and a repeat changes nothing.
 */
export const appendCloudTranscriptSchema = z.object({
  cloudSessionId: cloudSessionRefSchema,
  /** The number of the first line, counted from the transcript's first: 0. */
  from: z.number().int().min(0),
  lines: z
    .array(z.string().max(MAX_CLOUD_TRANSCRIPT_LINE_BYTES))
    .min(1)
    .max(MAX_CLOUD_TRANSCRIPT_BATCH),
});

export type AppendCloudTranscriptDto = z.infer<typeof appendCloudTranscriptSchema>;

/** The longest a Stop hook may hold its request open for a reply, in seconds. */
export const MAX_CLOUD_REPLY_WAIT_SECONDS = 120;

/**
 * `POST /sessions/cloud-replies/take`, from the session's Stop hook: the oldest
 * reply nobody has collected, waiting up to `wait` seconds for one.
 */
export const takeCloudReplySchema = z.object({
  cloudSessionId: cloudSessionRefSchema,
  wait: z.number().int().min(0).max(MAX_CLOUD_REPLY_WAIT_SECONDS).default(0),
});

export type TakeCloudReplyDto = z.infer<typeof takeCloudReplySchema>;

/**
 * How long a reply waits for the session's Stop hook before a host sends it
 * instead, in seconds. A hook that is waiting looks every second, so one that
 * is there takes it well inside this; past it the session is idle, or in a turn
 * Claude Code queues the message behind, and a host signed in to the session's
 * claude.ai account sends it with `claude -p … --cloud <id>`, which wakes it.
 */
export const CLOUD_REPLY_WAKE_AFTER_SECONDS = 15;

/**
 * Which way a reply reached the agent: `hook`, collected by the session's Stop
 * hook; `host`, sent from a host with `claude -p … --cloud <id>`.
 */
export const CLOUD_REPLY_DELIVERIES = ['hook', 'host'] as const;

export type CloudReplyDelivery = (typeof CLOUD_REPLY_DELIVERIES)[number];

/** `POST /sessions/{id}/cloud-replies`: what the person typed in the session's chat. */
export const sendCloudReplySchema = z.object({
  text: z.string().trim().min(1).max(20_000),
});

export type SendCloudReplyDto = z.infer<typeof sendCloudReplySchema>;

/** `GET /sessions/{id}/cloud-chat`: the lines numbered `from` on, at most `limit`. */
export const findCloudChatSchema = z.object({
  from: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});

export type FindCloudChatDto = z.infer<typeof findCloudChatSchema>;

/**
 * How the Stop hook hands a reply to the agent: the first line of its block
 * `reason`, the reply's words after it. Claude Code keeps that reason in the
 * transcript as a hidden "Stop hook feedback" line, and the console reads a
 * line that carries this as the person's message, where the agent took it.
 */
export const CLOUD_REPLY_PREAMBLE = 'The person following this session in Oppenheimer replied:';
