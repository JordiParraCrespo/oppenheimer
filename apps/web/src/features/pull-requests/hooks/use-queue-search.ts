import type { PullRequestLane, PullRequestScope } from '@oppenheimer/frontend-consumer';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { QueueChecks, QueueWait } from '../lib/queue-search';

/** The queue's scope, repository and facets, read from the URL and written back to it. */
export function useQueueSearch() {
  const search = useSearch({ from: '/_authenticated/pulls/' });
  const navigate = useNavigate({ from: '/pulls/' });
  return {
    scope: search.scope ?? ('mine' as PullRequestScope),
    filters: { repo: search.repo, lane: search.lane, checks: search.checks, wait: search.wait },
    setScope: (scope: PullRequestScope) =>
      navigate({
        search: (prev) => ({ ...prev, scope: scope === 'mine' ? undefined : scope }),
      }),
    setRepo: (repo: string | undefined) => navigate({ search: (prev) => ({ ...prev, repo }) }),
    setLane: (lane: PullRequestLane | undefined) =>
      navigate({ search: (prev) => ({ ...prev, lane }) }),
    setChecks: (checks: QueueChecks | undefined) =>
      navigate({ search: (prev) => ({ ...prev, checks }) }),
    setWait: (wait: QueueWait | undefined) => navigate({ search: (prev) => ({ ...prev, wait }) }),
  };
}
