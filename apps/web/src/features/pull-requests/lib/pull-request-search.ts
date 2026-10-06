import { z } from 'zod';

export const PULL_REQUEST_VIEWS = ['briefing', 'description', 'changes'] as const;
export type PullRequestView = (typeof PULL_REQUEST_VIEWS)[number];

/** Which of a pull request's three views is up: a link to its changes opens on them. */
export const pullRequestSearchSchema = z.object({
  view: z.enum(PULL_REQUEST_VIEWS).optional().catch(undefined),
});

/**
 * The page each view is: the description an article, the briefing a page of
 * cards, the changes the whole pane, so the diff scrolls beside a file tree
 * that stays put. The route declares it from its search, so the shell frames
 * every view and the bar stays above them.
 */
export function pullRequestPane(view: unknown): 'narrow' | 'wide' | 'full' {
  if (view === 'description') return 'narrow';
  if (view === 'changes') return 'full';
  return 'wide';
}
