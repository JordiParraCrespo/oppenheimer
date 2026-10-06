import type { PullRequestLane, PullRequestScope } from '@oppenheimer/frontend-consumer';
import { useNavigate, useSearch } from '@tanstack/react-router';

/** The queue's facets, read from the URL and written back to it. */
export function useQueueSearch() {
  const search = useSearch({ from: '/_authenticated/pulls/' });
  const navigate = useNavigate({ from: '/pulls/' });
  return {
    scope: search.scope ?? ('mine' as PullRequestScope),
    lane: search.lane,
    repo: search.repo,
    setScope: (scope: PullRequestScope) =>
      navigate({
        search: (prev) => ({
          ...prev,
          scope: scope === 'mine' ? undefined : scope,
          lane: undefined,
        }),
      }),
    setLane: (lane: PullRequestLane | undefined) =>
      navigate({ search: (prev) => ({ ...prev, lane }) }),
  };
}
