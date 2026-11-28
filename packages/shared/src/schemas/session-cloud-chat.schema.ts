import { z } from 'zod';

/**
 * A Claude Code cloud session's chat in the console: two
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
 * hook; `host`, sent from a host with `claude -p … --cloud <id>`; `browser`,
 * posted to the session on claude.ai by the browser extension, as the person.
 */
export const CLOUD_REPLY_DELIVERIES = ['hook', 'host', 'browser'] as const;

export type CloudReplyDelivery = (typeof CLOUD_REPLY_DELIVERIES)[number];

/** `POST /sessions/{id}/cloud-replies`: what the person typed in the session's chat. */
export const sendCloudReplySchema = z.object({
  text: z.string().trim().min(1).max(20_000),
});

export type SendCloudReplyDto = z.infer<typeof sendCloudReplySchema>;

/** The lines one read of a cloud chat answers when it names no `limit`. */
export const CLOUD_CHAT_PAGE_LINES = 500;

/** `GET /sessions/{id}/cloud-chat`: the lines numbered `from` on, at most `limit`. */
export const findCloudChatSchema = z.object({
  from: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(1000).default(CLOUD_CHAT_PAGE_LINES),
});

export type FindCloudChatDto = z.infer<typeof findCloudChatSchema>;

/**
 * How the Stop hook hands a reply to the agent: the first line of its block
 * `reason`, the reply's words after it. Claude Code keeps that reason in the
 * transcript as a hidden "Stop hook feedback" line, and the console reads a
 * line that carries this as the person's message, where the agent took it.
 */
export const CLOUD_REPLY_PREAMBLE = 'The person following this session in Oppenheimer replied:';

/**
 * Where a cloud session's chat is read from: `hook`, the transcript the
 * session's SessionStart hook sends; `browser`, the session's event log on
 * claude.ai, which the browser extension reads with the person's own sign-in.
 * A session the extension has read is served from its lines alone.
 */
export const CLOUD_CHAT_SOURCES = ['hook', 'browser'] as const;

export type CloudChatSource = (typeof CLOUD_CHAT_SOURCES)[number];

/** The longest title an adopted session takes from claude.ai, in characters. */
export const MAX_CLOUD_SESSION_TITLE = 200;

/**
 * `POST /sessions/cloud-events`, from the browser extension: events of a Claude
 * Code cloud session's log on claude.ai, oldest first, each as the transcript
 * entry claude.ai keeps (`line`, JSON text) under the id claude.ai gave it. A
 * session this workspace does not know yet is adopted. An event already held
 * is skipped, so a batch sent again changes nothing.
 */
export const recordCloudEventsSchema = z.object({
  cloudSessionId: cloudSessionRefSchema,
  /** The session's title on claude.ai, which names an adopted session. */
  title: z.string().trim().max(MAX_CLOUD_SESSION_TITLE).optional(),
  events: z
    .array(
      z.object({
        id: z.string().min(1).max(128),
        line: z.string().max(MAX_CLOUD_TRANSCRIPT_LINE_BYTES),
      }),
    )
    .min(1)
    .max(MAX_CLOUD_TRANSCRIPT_BATCH),
});

export type RecordCloudEventsDto = z.infer<typeof recordCloudEventsSchema>;

/**
 * The longest the extension may hold a request open for replies, in seconds:
 * well inside the 15 seconds after which a host is asked to send a reply
 * instead (`CLOUD_REPLY_WAKE_AFTER_SECONDS`), so a running extension takes them.
 */
export const MAX_BROWSER_REPLY_WAIT_SECONDS = 10;

/**
 * How long the extension's claim on a reply holds, in seconds, before the
 * reply waits again unless the extension said claude.ai took it: long enough
 * to post it, short enough that a claim lost with its answer, or with a
 * worker Chrome stopped, holds the reply back for a minute at most.
 */
export const BROWSER_REPLY_LEASE_SECONDS = 60;

/**
 * `POST /sessions/cloud-replies/claim`, from the browser extension: every
 * reply waiting in this workspace's Claude Code cloud sessions, now claimed
 * for the extension to post on claude.ai, waiting up to `wait` seconds for one.
 */
export const claimCloudRepliesSchema = z.object({
  wait: z.number().int().min(0).max(MAX_BROWSER_REPLY_WAIT_SECONDS).default(0),
});

export type ClaimCloudRepliesDto = z.infer<typeof claimCloudRepliesSchema>;

/**
 * `POST /sessions/cloud-replies/{replyId}/release`, from the browser
 * extension: claude.ai refused the reply it claimed, so it waits again for
 * the session's Stop hook or a host.
 */
export const releaseCloudReplySchema = z.object({
  /** Why claude.ai refused it, for the log: its HTTP status, or `network`. */
  reason: z.string().max(64).optional(),
});

export type ReleaseCloudReplyDto = z.infer<typeof releaseCloudReplySchema>;
