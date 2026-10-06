import { z } from 'zod';

export const PULL_REQUEST_VIEWS = ['briefing', 'description', 'changes'] as const;
export type PullRequestView = (typeof PULL_REQUEST_VIEWS)[number];

/** Which of a pull request's three views is up: a link to its changes opens on them. */
export const pullRequestSearchSchema = z.object({
  view: z.enum(PULL_REQUEST_VIEWS).optional().catch(undefined),
});
