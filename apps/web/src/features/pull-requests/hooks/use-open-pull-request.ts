import type { PullRequestAddress } from '@oppenheimer/frontend-consumer';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  type PullRequestView,
  type PullsReturn,
  pullRequestLink,
} from '../lib/pull-request-search';

declare module '@tanstack/react-router' {
  interface HistoryState {
    /** Where a pull request was opened from, written once by its opener: what its Back returns to. */
    pullsReturn?: PullsReturn;
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
    navigate({
      ...pullRequestLink(address, view),
      state: { pullsReturn: { to: 'queue', search: queue } },
    });
}
