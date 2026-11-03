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

/** `?project=unassigned` names the workspace's Unassigned project, which has no slug of its own to show. */
export const UNASSIGNED_SLUG = 'unassigned';

/** The slugs `?project=` lists, each once, in the order they were picked. */
export function projectSlugsOf(param: string | undefined): string[] {
  return [
    ...new Set(
      (param ?? '')
        .split(',')
        .map((slug) => slug.trim())
        .filter(Boolean),
    ),
  ];
}

/** `?project=` for a set of slugs; none is no key, so the view is All projects. */
export function projectParamOf(slugs: readonly string[]): string | undefined {
  return slugs.length ? slugs.join(',') : undefined;
}

/**
 * The ids of the projects a set of slugs names, `undefined` for no slugs (All
 * projects). A slug no project has names nothing, so a stale link narrows to
 * the projects that still exist, and to an empty set, which shows nothing,
 * when none does: it never widens to All projects.
 */
export function projectIdsOfSlugs(
  slugs: readonly string[],
  projects: readonly { id: string; slug: string; isUnassigned: boolean }[],
): string[] | undefined {
  if (slugs.length === 0) return undefined;
  return projects
    .filter((row) => slugs.includes(row.isUnassigned ? UNASSIGNED_SLUG : row.slug))
    .map((row) => row.id);
}

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
