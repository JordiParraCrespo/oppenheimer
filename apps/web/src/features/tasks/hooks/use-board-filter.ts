import { useProjects } from '@oppenheimer/frontend-consumer/react';
import { getRouteApi } from '@tanstack/react-router';
import type { BoardFilter } from '../lib/board';
import { projectIdsOfSlugs, projectSlugsOf } from '../lib/plan-scope';

const board = getRouteApi('/_authenticated/plan/');

/**
 * What the board's address narrows it to, as ids: the projects' slugs turned
 * into their ids, and the milestone. A slug no project has filters to nothing
 * rather than everything, so a stale link does not pretend to be All projects.
 */
export function useBoardFilter(): BoardFilter {
  const { project, milestone } = board.useSearch();
  const slugs = projectSlugsOf(project);
  const { data: projectIds } = useProjects({ select: (rows) => projectIdsOfSlugs(slugs, rows) });
  return {
    projectIds: slugs.length ? (projectIds ?? ['']) : undefined,
    milestoneId: milestone,
  };
}
