import { useNow } from '@oppenheimer/design-system-web';
import { todayIn } from '@oppenheimer/frontend-web';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { type StatsRange, statsRangeOf, statsRangeSearch } from '../lib/stats-range';

/** The range a project's Stats covers, in the URL, against today in the reader's calendar. */
export function useStatsRange() {
  const search = useSearch({ from: '/_authenticated/plan/projects_/$projectId' });
  const navigate = useNavigate({ from: '/plan/projects/$projectId' });
  const today = todayIn(useNow(60_000));
  return {
    today,
    range: statsRangeOf(search, today),
    setRange: (range: StatsRange) =>
      navigate({ search: (prev) => ({ ...prev, ...statsRangeSearch(range, today) }) }),
  };
}
