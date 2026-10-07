import { z } from 'zod';

export const PULL_REQUEST_VIEWS = ['description', 'briefing', 'changes'] as const;
export type PullRequestView = (typeof PULL_REQUEST_VIEWS)[number];

/**
 * Which of a pull request's three views is up. With none it opens on its
 * description, the way GitHub and the Codex app do; a link to its changes
 * opens on them.
 */
export const pullRequestSearchSchema = z.object({
  view: z.enum(PULL_REQUEST_VIEWS).optional().catch(undefined),
});

/**
 * The page each view is: the description an article with its rail, the
 * briefing a page of cards, the changes a diff as wide and as tall as the
 * pane. The route declares it from its search, so the shell frames every view
 * and the bar stays above them.
 */
export function pullRequestPane(view: PullRequestView | undefined): 'wide' | 'board' | 'fluid' {
  if (view === 'briefing') return 'wide';
  if (view === 'changes') return 'fluid';
  return 'board';
}
