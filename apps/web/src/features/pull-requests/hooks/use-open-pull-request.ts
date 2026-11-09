import type { PullRequestAddress } from '@oppenheimer/frontend-consumer';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { type PullRequestView, pullRequestLink } from '../lib/pull-request-search';
import type { QueueSearch } from '../lib/queue-search';
import type { ReviewSearch } from '../lib/review-deck';

declare module '@tanstack/react-router' {
  interface HistoryState {
    /** The queue's search a pull request was opened from: what its Back returns to. */
    pullsQueue?: QueueSearch;
    /** The review deck's search, card included, when it was opened from the deck: Back returns to that card. */
    pullsDeck?: ReviewSearch;
  }
}

/**
 * Opens a pull request from the queue, carrying the queue's scope, repository
 * and facets in the history state, so the pull request's Back returns to the
 * queue as it was left rather than to the whole of it.
 */
export function useOpenPullRequest() {
  const navigate = useNavigate();
  const queue = useSearch({ from: '/_authenticated/pulls/' });
  return (address: PullRequestAddress, view: PullRequestView) =>
    navigate({ ...pullRequestLink(address, view), state: { pullsQueue: queue } });
}
