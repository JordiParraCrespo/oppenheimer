import type { PlanStatsRequest } from '@oppenheimer/frontend-consumer';
import { getRouteApi } from '@tanstack/react-router';
import { resolveStatsPeriod, type StatsPreset } from '../lib/stats';
import { useScopeProject } from './use-scope-project';
import { useToday } from './use-today';

const stats = getRouteApi('/_authenticated/plan/stats');

/** The viewer's own zone, which Stats buckets weeks in. */
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * The Stats read the address asks for: the period (a preset or a custom
 * range, ending no later than the viewer's today), the project, the viewer's
 * zone and whether to compare. Every Stats section asks the same request, so
 * they share one read.
 */
export function useStatsPeriod(): {
  request: PlanStatsRequest;
  preset: StatsPreset | null;
  today: string;
} {
  const search = stats.useSearch();
  const today = useToday();
  const { projectId } = useScopeProject();
  const period = resolveStatsPeriod(search, today);
  return {
    request: {
      from: period.from,
      to: period.to,
      timeZone: TIME_ZONE,
      projectId: projectId || undefined,
      compare: search.compare !== 'off',
    },
    preset: period.preset,
    today,
  };
}
