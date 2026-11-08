import { z } from 'zod/v4';
import { commandIdSchema, sessionIdSchema } from './primitives.js';

/**
 * A reply to an idle Claude Code cloud session, sent from the host that
 * started it (`product/next-steps/cloud-agents.md`, "The chat of a cloud
 * session"). The session's Stop hook hands a reply to the agent when its turn
 * ends; once the hook has stopped waiting, only a new message wakes the
 * session, and the one route to it is the person's own `claude` CLI, signed in
 * to the claude.ai account that owns it: `claude -p <text> --cloud <id>`
 * queues the message and exits. The messages behind the `session.cloud.prompt`
 * capability. Part of `protocolMessageSchema`, which is where every kind is
 * listed.
 */

/** The longest reply the link carries, in characters: the chat's own bound. */
export const CLOUD_PROMPT_TEXT_MAX_CHARS = 20_000;

/**
 * Send `text` to the cloud session `cloudSessionId` (`session_…`), which this
 * host started for the console's session `sessionId`. Answered with
 * `session.cloud.prompted`, or `command.failed`: `SESS_019` the host's Claude
 * Code is not signed in to claude.ai, `SESS_020` the CLI did not take it.
 */
export const sessionCloudPromptSchema = z.object({
  type: z.literal('session.cloud.prompt'),
  commandId: commandIdSchema,
  sessionId: sessionIdSchema,
  cloudSessionId: z.string().regex(/^session_[A-Za-z0-9]{8,64}$/),
  text: z.string().min(1).max(CLOUD_PROMPT_TEXT_MAX_CHARS),
});

export type SessionCloudPromptMessage = z.infer<typeof sessionCloudPromptSchema>;

/** The CLI took the message: the session has it queued, and wakes for it. */
export const sessionCloudPromptedSchema = z.object({
  type: z.literal('session.cloud.prompted'),
  commandId: commandIdSchema,
});

export type SessionCloudPromptedMessage = z.infer<typeof sessionCloudPromptedSchema>;
