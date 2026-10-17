import { useProjects } from '@oppenheimer/frontend-consumer/react';
import { getRouteApi } from '@tanstack/react-router';
import type { BoardFilter } from '../lib/board';
import { projectIdOfSlug } from '../lib/plan-scope';

const board = getRouteApi('/_authenticated/plan/');

/**
 * What the board's address narrows it to, as ids: the project's slug turned
 * into its id, and the milestone. A slug no project has filters to nothing rather
 * than everything, so a stale link does not pretend to be All projects.
 */
export function useBoardFilter(): BoardFilter & { projectSlug?: string } {
  const { project, milestone } = board.useSearch();
  const { data: projectId } = useProjects({ select: (rows) => projectIdOfSlug(project, rows) });
  return {
    projectSlug: project,
    projectId: project ? (projectId ?? '') : undefined,
    milestoneId: milestone,
  };
}
