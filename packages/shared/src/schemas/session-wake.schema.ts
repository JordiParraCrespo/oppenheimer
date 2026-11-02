import { z } from 'zod';

/**
 * What wakes a session's agent when it is not being typed to
 * (`product/next-steps/agent-tools.md` §3 and §4): its pull requests, which
 * it asks to watch with `runner sessions watch-pr`, logged by the runner as
 * `pull.watched`; the GitHub events on one are typed into the session as a
 * line once its agent is at its prompt.
 */

/** The event kind a watch (or its end) is logged as. */
export const PULL_WATCHED_EVENT_KIND = 'pull.watched';

/** How many pull requests one session watches at most; a new one past it drops the oldest. */
export const SESSION_WATCHED_PULLS_MAX = 10;

/** One pull request a session watches: its repository by GitHub's id, and its number. */
export const sessionWatchedPullSchema = z.object({
  githubRepoId: z.string().regex(/^\d{1,20}$/),
  number: z.number().int().min(1),
});

/** What the runner logs: watch it, or stop. */
export const pullWatchedPayloadSchema = sessionWatchedPullSchema.extend({
  watch: z.boolean(),
});

export type SessionWatchedPull = z.infer<typeof sessionWatchedPullSchema>;
