import { z } from 'zod/v4';
import { commandIdSchema } from './primitives.js';

/**
 * A reply that wakes an idle Claude Code cloud session
 * (`product/next-steps/cloud-agents.md`, "The chat of a cloud session",
 * decision 2): what the person typed in the console's chat, sent from a host
 * signed in to the claude.ai account the session runs on, with
 * `claude -p <text> --cloud <id>`. Part of `protocolMessageSchema`, which is
 * where every kind is listed.
 */

/**
 * The longest message the link carries: a reply at the console's own limit
 * (20,000 characters), with room for the line the Stop hook's hand-over opens
 * with (`CLOUD_REPLY_PREAMBLE`), which a host's send carries too.
 */
export const CLOUD_REPLY_MAX_CHARS = 21_000;

/**
 * Send `text` to the cloud session `cloudSessionId` (`session_…`) as the
 * person's next message. Sent only to a runner whose hello named
 * `session.cloud.reply`; answered by `cloud.replied` with the same
 * `commandId`, or by `command.failed` (`SESS_019` the host's Claude Code is
 * not signed in to claude.ai, `SESS_020` Claude Code certainly did not send
 * it, `SESS_021` it gave no answer in time and may have).
 */
export const cloudReplySchema = z.object({
  type: z.literal('cloud.reply'),
  commandId: commandIdSchema,
  cloudSessionId: z.string().regex(/^session_[A-Za-z0-9]{8,64}$/),
  text: z.string().min(1).max(CLOUD_REPLY_MAX_CHARS),
});

export type CloudReplyMessage = z.infer<typeof cloudReplySchema>;

/** Claude Code took the message for the session: it runs it now, or after the turn it is in. */
export const cloudRepliedSchema = z.object({
  type: z.literal('cloud.replied'),
  commandId: commandIdSchema,
});

export type CloudRepliedMessage = z.infer<typeof cloudRepliedSchema>;
