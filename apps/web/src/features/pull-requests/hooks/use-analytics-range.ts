import type { PullRequestAnalyticsRange } from '@oppenheimer/frontend-consumer';
import { useNavigate, useSearch } from '@tanstack/react-router';

/** The analytics range, in the URL. */
export function useAnalyticsRange() {
  const search = useSearch({ from: '/_authenticated/pulls/analytics' });
  const navigate = useNavigate({ from: '/pulls/analytics' });
  return {
    range: search.range ?? ('month' as PullRequestAnalyticsRange),
    setRange: (range: PullRequestAnalyticsRange) =>
      navigate({ search: { range: range === 'month' ? undefined : range } }),
  };
}
