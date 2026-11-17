import { useProjects } from '@oppenheimer/frontend-consumer/react';
import { getRouteApi } from '@tanstack/react-router';
import { projectIdsOfSlugs, projectSlugsOf } from '../lib/calendar-search';

const calendar = getRouteApi('/_authenticated/plan/calendar');

/**
 * The projects the calendar's tasks and automation runs are narrowed to: the
 * slugs `?project=` lists and the ids they name (absent for every project;
 * empty while the projects load, or when none of them exists).
 */
export function useCalendarProjects(): { slugs: string[]; projectIds?: readonly string[] } {
  const { project } = calendar.useSearch();
  const slugs = projectSlugsOf(project);
  const { data: projectIds } = useProjects({ select: (rows) => projectIdsOfSlugs(slugs, rows) });
  return { slugs, projectIds: slugs.length ? (projectIds ?? []) : undefined };
}
