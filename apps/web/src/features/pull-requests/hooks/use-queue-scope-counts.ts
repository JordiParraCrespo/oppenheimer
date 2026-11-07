import type { PullRequestQueueName } from '@oppenheimer/frontend-consumer';
import { usePullRequestQueue } from '@oppenheimer/frontend-consumer/react';
import { scopeCounts } from '../lib/queue-filter';
import { useQueueSearch } from './use-queue-search';

/**
 * Each scope tab's count, as its table would show it. With a repository or a
 * facet picked in the address, counted from the `all` queue's rows, which each
 * carry their scope; with none, the API's counts for the scope on screen, so
 * the default view makes no second read. Undefined until the read answers.
 */
export function useQueueScopeCounts(): Record<PullRequestQueueName, number> | undefined {
  const { scope, filters } = useQueueSearch();
  const filtered = Object.values(filters).some((value) => value !== undefined);
  const { data: unfiltered } = usePullRequestQueue(scope, {
    select: (queue) => queue.scopes,
    enabled: !filtered,
  });
  const { data: narrowed } = usePullRequestQueue('all', {
    select: (queue) => scopeCounts(queue.items, filters),
    enabled: filtered,
  });
  return filtered ? narrowed : unfiltered;
}
