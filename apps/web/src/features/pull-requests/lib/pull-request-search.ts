import type { PullRequestAddress } from '@oppenheimer/frontend-consumer';
import { z } from 'zod';

export const PULL_REQUEST_VIEWS = ['description', 'changes', 'chat'] as const;
export type PullRequestView = (typeof PULL_REQUEST_VIEWS)[number];

/**
 * Absent `view` is the description. `briefing` was a view of its own until the
 * description took its place; a link that still names it opens the
 * description.
 */
export const pullRequestSearchSchema = z.object({
  view: z
    .enum([...PULL_REQUEST_VIEWS, 'briefing'])
    .optional()
    .catch(undefined)
    .transform((view) => (view === 'briefing' ? undefined : view)),
});

/** The view a pull request opens on, and the one its address leaves out. */
const DEFAULT_PULL_REQUEST_VIEW = 'description' satisfies PullRequestView;

export function resolvePullRequestView(view: PullRequestView | undefined): PullRequestView {
  return view ?? DEFAULT_PULL_REQUEST_VIEW;
}

/** The search that shows `view`: the default is the bare address. */
export function pullRequestSearch(view: PullRequestView): { view?: PullRequestView } {
  return view === DEFAULT_PULL_REQUEST_VIEW ? {} : { view };
}

/** Where a pull request opens, on `view`: the route, its params and its search. */
export function pullRequestLink(address: PullRequestAddress, view: PullRequestView) {
  return {
    to: '/pulls/$installationId/$githubRepoId/$number',
    params: {
      installationId: address.installationId,
      githubRepoId: String(address.githubRepoId),
      number: String(address.number),
    },
    search: pullRequestSearch(view),
  } as const;
}

/**
 * The page each view is: the description an article with its rail at the
 * board's measure, the changes a diff as wide and as tall as the pane, the
 * chat the review session's terminal, which is the pane itself. The route
 * declares it from its search, so the shell frames every view and the bar
 * stays above them.
 */
const PANE = {
  description: 'board',
  changes: 'fluid',
  chat: 'full',
} as const satisfies Record<PullRequestView, 'board' | 'fluid' | 'full'>;

export function pullRequestPane(view: PullRequestView | undefined): 'board' | 'fluid' | 'full' {
  return PANE[resolvePullRequestView(view)];
}
