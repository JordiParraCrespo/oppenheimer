import { z } from 'zod/v4';
import { CHAT_ENTRY_MAX_BYTES } from './link.js';
import { commandIdSchema, sessionIdSchema } from './primitives.js';

/**
 * A session's conversation, read by the control plane on request
 * (`product/next-steps/agent-tools.md` §8): the messages behind the
 * `transcript.read` capability. Part of `protocolMessageSchema`, which is
 * where every kind is listed.
 *
 * The runner already compacts each agent's own transcript into the chat
 * view's entries (Claude Code's line shape, `attachment.chat`). This reads
 * the same entries one page at a time, for a reader with no browser
 * attached: a bot, the `opp` CLI, an MCP client. Nothing is kept by the
 * control plane; each page is read off the host when it is asked for.
 *
 * A page is addressed by the conversation it is read from and a byte
 * offset into it, both the runner's. The control plane hands them back as an
 * opaque cursor and never reads meaning into either.
 */

/** The most entries one page carries. */
export const TRANSCRIPT_PAGE_MAX_ENTRIES = 200;

/**
 * The most bytes one page's entries add up to: well under the link's frame
 * (`LINK_MAX_FRAME_BYTES`), since a page rides the control queue ahead of the
 * session's panes.
 */
export const TRANSCRIPT_PAGE_MAX_BYTES = 256 * 1024;

/**
 * The runner's name for the conversation a page was read from: a digest of
 * where its file is, never the path; a fresh schema per use, like `forwardedPort`. A new conversation in the same session
 * (the agent cleared it, or the person started another) is a new name.
 */
const conversationId = () =>
  z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/);

/**
 * Read a page of the session's conversation. Sent only to a runner whose
 * hello named `transcript.read`; answered by `transcript.page` with the same
 * `commandId`, or by `command.failed`: `SESS_001` the session is not on this
 * host, `SESS_018` its agent keeps no transcript the runner can read.
 *
 * Without `conversation`, the page is the conversation's tail: its last
 * turns, up to `limit` entries. With the `conversation` a page was read from
 * and its `after` (absent is 0, the conversation's start), the entries that
 * follow that offset, oldest first: `after` is read only beside
 * `conversation`, since a runner's struct cannot tell 0 from absent. An offset that is not where
 * a line starts in that conversation, or a conversation that is no longer
 * the session's, is answered from the start of the current one with
 * `restarted`, so a stale cursor never reads a line from its middle.
 */
export const transcriptReadSchema = z.object({
  type: z.literal('transcript.read'),
  commandId: commandIdSchema,
  sessionId: sessionIdSchema,
  conversation: conversationId().optional(),
  after: z.number().int().nonnegative().optional(),
  limit: z.number().int().min(1).max(TRANSCRIPT_PAGE_MAX_ENTRIES),
});

export type TranscriptReadMessage = z.infer<typeof transcriptReadSchema>;

/**
 * One page: the chat view's entries, oldest first, each the JSON of one line
 * in Claude Code's shape as `attachment.chat` carries them, already cut to
 * the chat's own bounds on the host. `entries` is always an array, empty
 * for a page with nothing in it, never null.
 */
export const transcriptPageSchema = z.object({
  type: z.literal('transcript.page'),
  commandId: commandIdSchema,
  /** Absent while the agent has written no conversation yet. */
  conversation: conversationId().optional(),
  entries: z.array(z.string().min(1).max(CHAT_ENTRY_MAX_BYTES)).max(TRANSCRIPT_PAGE_MAX_ENTRIES),
  /** Where the page starts in the conversation, as a byte offset. */
  from: z.number().int().nonnegative(),
  /** Where the next page starts: `after` for the read that follows this one. */
  next: z.number().int().nonnegative(),
  /** The page reached the end of what the agent has written so far. */
  atEnd: z.boolean(),
  /** The cursor asked with no longer applied, so the page starts the current conversation over. */
  restarted: z.boolean().optional(),
  /**
   * Entries in the page's range left out: over the entry bound, or past what
   * one page holds in bytes. A reader that sees one knows the page is not the
   * whole of that range.
   */
  dropped: z.number().int().nonnegative().optional(),
  /**
   * Lines in the page's range that a transcriber reading from the middle
   * could not place (a tool result whose call came before the page). Codex's
   * transcriber carries state from line to line; Claude Code's does not.
   */
  partial: z.boolean().optional(),
});

export type TranscriptPageMessage = z.infer<typeof transcriptPageSchema>;
