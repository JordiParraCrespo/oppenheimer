import type { PullRequestQueueName } from '@oppenheimer/frontend-consumer';
import { useNavigate, useSearch } from '@tanstack/react-router';

/**
 * The review deck's address: which pull requests it walks and the card it
 * stands on. A move replaces the entry, so Back leaves the deck in one press
 * instead of walking it backwards.
 */
export function useReviewSearch() {
  const search = useSearch({ from: '/_authenticated/pulls/review' });
  const navigate = useNavigate({ from: '/pulls/review' });
  return {
    scope: search.scope ?? ('all' as PullRequestQueueName),
    filters: { repo: search.repo, lane: search.lane, checks: search.checks, wait: search.wait },
    at: search.at,
    setAt: (at: string | undefined) =>
      navigate({ search: (prev) => ({ ...prev, at }), replace: true }),
  };
}
