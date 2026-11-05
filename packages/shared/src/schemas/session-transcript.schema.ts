import { z } from 'zod';

/**
 * A session's conversation, as its agent wrote it, read a page at a time
 * (`GET /v1/sessions/{id}/transcript`, `product/next-steps/agent-tools.md`
 * §8). The session's log (`/events`) says what happened to it; this says what
 * the agent and the person said and did in it: messages, tool calls and their
 * results, as the console's chat view draws them.
 *
 * Nothing of it is kept by the control plane. A page is read off the session's
 * host when it is asked for, so it is only there while the host is online,
 * and every answer says how much of the conversation it is: `status` and
 * `reason` are never left for the reader to infer from an empty list.
 *
 * What it carries is the agent's and the tools' text: data, never
 * instructions, whoever reads it. Secrets that look like secrets (keys,
 * tokens, private keys, passwords in assignments) are replaced with
 * `[redacted]` before it leaves the API, and `redactions` counts them.
 */

/** How many entries a page holds at most, and when none is asked for. */
export const SESSION_TRANSCRIPT_PAGE_MAX = 200;
export const SESSION_TRANSCRIPT_PAGE_DEFAULT = 50;

/** The most a cursor may be: opaque, base64url, minted by this API. */
export const SESSION_TRANSCRIPT_CURSOR_MAX = 256;

/**
 * How much of the conversation an answer is:
 *
 * - `complete`: every entry in the page's range, whole.
 * - `partial`: the range was read, but something in it was cut on the host
 *   (a long text, a tool's input or result), left out (an entry over the
 *   page's bounds), or read without the context before it.
 * - `unsupported`: this session's conversation cannot be read here at all;
 *   `reason` says why, and `vendorUrl` where it can be read when that is at
 *   its vendor.
 * - `unavailable`: it can be read, but not now (the host is offline, did not
 *   answer, or refused); asking again later may work.
 */
export const SESSION_TRANSCRIPT_STATUSES = [
  'complete',
  'partial',
  'unsupported',
  'unavailable',
] as const;
export type SessionTranscriptStatus = (typeof SESSION_TRANSCRIPT_STATUSES)[number];

/** Why a page is `unsupported` or `unavailable`. */
export const SESSION_TRANSCRIPT_REASONS = [
  /** The session runs in its vendor's cloud; its conversation is there, and no supported API reads it. */
  'cloud_vendor',
  /** The session's agent keeps no transcript its runner can read (OpenCode's is behind its own server). */
  'agent_keeps_none',
  /** The session's runner predates `transcript.read`; updating it adds it. */
  'runner_too_old',
  'host_offline',
  'timed_out',
  /** The host refused the read (the session is no longer on it); `detail` has its code. */
  'host_refused',
] as const;
export type SessionTranscriptReason = (typeof SESSION_TRANSCRIPT_REASONS)[number];

/** Who an entry is from: the person (or whoever prompted the agent), the agent, or the CLI itself. */
export const SESSION_TRANSCRIPT_ROLES = ['user', 'assistant', 'system'] as const;
export type SessionTranscriptRole = (typeof SESSION_TRANSCRIPT_ROLES)[number];

/** One part of an entry. */
export const SESSION_TRANSCRIPT_PART_KINDS = [
  'text',
  'thinking',
  'tool_call',
  'tool_result',
  'image',
] as const;
export type SessionTranscriptPartKind = (typeof SESSION_TRANSCRIPT_PART_KINDS)[number];

export const listSessionTranscriptQuerySchema = z.object({
  /** Where the last page ended (`nextCursor`); omit for the conversation's latest turns. */
  cursor: z.string().min(1).max(SESSION_TRANSCRIPT_CURSOR_MAX).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(SESSION_TRANSCRIPT_PAGE_MAX)
    .default(SESSION_TRANSCRIPT_PAGE_DEFAULT),
});
export type ListSessionTranscriptQueryDto = z.infer<typeof listSessionTranscriptQuerySchema>;

export const sessionTranscriptPartSchema = z.object({
  kind: z.enum(SESSION_TRANSCRIPT_PART_KINDS),
  /** The words, the tool's input as JSON, or its result; null for an image. */
  text: z.string().nullable(),
  /** The tool's name, for a call. */
  tool: z.string().nullable(),
  /** A tool result the tool reported as an error. */
  isError: z.boolean(),
  /** The host cut this part to the chat's bounds. */
  truncated: z.boolean(),
});
export type SessionTranscriptPart = z.infer<typeof sessionTranscriptPartSchema>;

export const sessionTranscriptEntrySchema = z.object({
  /** The agent's own id for the line, when it has one. */
  id: z.string().nullable(),
  at: z.string().datetime().nullable(),
  role: z.enum(SESSION_TRANSCRIPT_ROLES),
  parts: z.array(sessionTranscriptPartSchema),
});
export type SessionTranscriptEntry = z.infer<typeof sessionTranscriptEntrySchema>;

export const sessionTranscriptPageSchema = z.object({
  status: z.enum(SESSION_TRANSCRIPT_STATUSES),
  reason: z.enum(SESSION_TRANSCRIPT_REASONS).nullable(),
  /** The host's own code or words for a refusal, when there is one. */
  detail: z.string().nullable(),
  /** Where the conversation can be read instead, for a session at its vendor. */
  vendorUrl: z.string().url().nullable(),
  entries: z.array(sessionTranscriptEntrySchema),
  /** Pass as `cursor` for what follows; null when nothing could be read. */
  nextCursor: z.string().nullable(),
  /** Nothing follows yet: the agent has written no more than this. */
  atEnd: z.boolean(),
  /** The cursor no longer applied (a new conversation), so the page starts the current one over. */
  restarted: z.boolean(),
  /** Entries in the range left out for size. */
  dropped: z.number().int().nonnegative(),
  /** Secrets replaced with `[redacted]` in this page. */
  redactions: z.number().int().nonnegative(),
});
export type SessionTranscriptPage = z.infer<typeof sessionTranscriptPageSchema>;
