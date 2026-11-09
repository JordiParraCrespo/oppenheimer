import type { PlanStatsQuery } from '@oppenheimer/frontend-consumer';
import { viewerTimeZone } from '@oppenheimer/frontend-web';
import { useMemo } from 'react';
import { useStatsRange } from './use-stats-range';

/** The stats read a project's page asks for: its range in the reader's timezone, one object per range. */
export function useStatsQuery(projectId: string): PlanStatsQuery {
  const { range } = useStatsRange();
  return useMemo(
    () => ({ from: range.from, to: range.to, timeZone: viewerTimeZone(), projectId }),
    [range.from, range.to, projectId],
  );
}
