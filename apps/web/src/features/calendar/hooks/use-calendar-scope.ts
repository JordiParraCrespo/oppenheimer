import { useProjects } from '@oppenheimer/frontend-consumer/react';
import { projectIdsOfSlugs, projectSlugsOf } from '@oppenheimer/frontend-web';
import { getRouteApi } from '@tanstack/react-router';
import { type CalendarScope, shownStatuses } from '../lib/calendar-search';

const calendar = getRouteApi('/_authenticated/plan/calendar');

/**
 * What the calendar's filter row narrows to, from the address: the project
 * slugs `?project=` lists and the ids they name (absent for every project;
 * empty while the projects load, when they fail, or when none of them
 * exists), the statuses shown and who added a task.
 */
export function useCalendarScope(): CalendarScope & { slugs: string[] } {
  const project = calendar.useSearch({ select: (search) => search.project });
  const status = calendar.useSearch({ select: (search) => search.status });
  const origin = calendar.useSearch({ select: (search) => search.origin });
  const slugs = projectSlugsOf(project);
  const { data: projectIds } = useProjects({ select: (rows) => projectIdsOfSlugs(slugs, rows) });
  return {
    slugs,
    projectIds: slugs.length ? (projectIds ?? []) : undefined,
    statuses: shownStatuses(status),
    origin,
  };
}
