import { z } from 'zod';

export const PULL_REQUEST_VIEWS = ['description', 'briefing', 'changes'] as const;
export type PullRequestView = (typeof PULL_REQUEST_VIEWS)[number];

/** Absent `view` is the description. */
export const pullRequestSearchSchema = z.object({
  view: z.enum(PULL_REQUEST_VIEWS).optional().catch(undefined),
});

/** The view a pull request opens on, and the one its address leaves out. */
export const DEFAULT_PULL_REQUEST_VIEW = 'description' satisfies PullRequestView;

export function resolvePullRequestView(view: PullRequestView | undefined): PullRequestView {
  return view ?? DEFAULT_PULL_REQUEST_VIEW;
}

/** The search that shows `view`: the default is the bare address. */
export function pullRequestSearch(view: PullRequestView): { view?: PullRequestView } {
  return view === DEFAULT_PULL_REQUEST_VIEW ? {} : { view };
}

/**
 * The page each view is: the description an article with its rail, the
 * briefing a page of cards, the changes a diff as wide and as tall as the
 * pane. The route declares it from its search, so the shell frames every view
 * and the bar stays above them.
 */
const PANE = {
  description: 'board',
  briefing: 'wide',
  changes: 'fluid',
} as const satisfies Record<PullRequestView, 'wide' | 'board' | 'fluid'>;

export function pullRequestPane(view: PullRequestView | undefined): 'wide' | 'board' | 'fluid' {
  return PANE[resolvePullRequestView(view)];
}
