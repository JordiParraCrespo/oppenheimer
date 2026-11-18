import { searchText } from '@oppenheimer/frontend-web';
import { z } from 'zod';

/**
 * The projects a Plan view is narrowed to, by slug (`unassigned` for the
 * workspace's Unassigned project), comma-separated: `?project=web,billing`. A
 * slug is lower-case kebab, so a comma never sits inside one, and a link to a
 * single project reads as it always did. The board and Milestones both read
 * it, from the Project filter above each.
 */
export const planScopeSearchSchema = z.object({ project: searchText });
export type PlanScopeSearch = z.infer<typeof planScopeSearchSchema>;

/** How many tasks each Plan filter option holds: all of them, and per project and milestone. */
export interface PlanCounts {
  all: number;
  byProject: Record<string, number>;
  byMilestone: Record<string, number>;
}

/**
 * The filter row's counts from the board's tasks, as a plain object: the
 * query's structural sharing keeps it by reference while no count moves, so a
 * drag inside a column does not redraw the filters.
 */
export function planCounts(
  tasks: readonly { projectId: string; milestoneId: string | null }[],
): PlanCounts {
  const counts: PlanCounts = { all: tasks.length, byProject: {}, byMilestone: {} };
  for (const task of tasks) {
    counts.byProject[task.projectId] = (counts.byProject[task.projectId] ?? 0) + 1;
    if (task.milestoneId)
      counts.byMilestone[task.milestoneId] = (counts.byMilestone[task.milestoneId] ?? 0) + 1;
  }
  return counts;
}
