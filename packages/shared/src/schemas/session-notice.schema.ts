import { z } from 'zod';

/**
 * A line an agent sent the person from its session (`runner sessions notify`,
 * `product/next-steps/agent-tools.md` §2): logged by the runner as
 * `agent.notified { id, text }`, kept on the session as its latest notice
 * with when it came, and shown in the Inbox until the person marks it done.
 * The id is the runner's, so a mark on one notice never hides the next.
 */

/** The event kind a notice is logged as. */
export const AGENT_NOTIFIED_EVENT_KIND = 'agent.notified';

/** The runner's own bound on a notice, in bytes; a line, not a report. */
export const SESSION_NOTICE_TEXT_MAX = 500;

/** What the runner logs. */
export const agentNotifiedPayloadSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/),
  text: z.string().min(1).max(SESSION_NOTICE_TEXT_MAX),
});

/** What the session keeps: the latest notice and when it was logged. */
export const sessionNoticeSchema = agentNotifiedPayloadSchema.extend({
  at: z.string().datetime(),
});

export type SessionNotice = z.infer<typeof sessionNoticeSchema>;
