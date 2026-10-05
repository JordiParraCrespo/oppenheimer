import { useProjects } from '@oppenheimer/frontend-consumer/react';
import { getRouteApi } from '@tanstack/react-router';
import type { BoardFilter } from '../lib/board';

const board = getRouteApi('/_authenticated/plan/');

/** `?project=unassigned` names the workspace's Unassigned project, which has no slug of its own to show. */
export const UNASSIGNED_SLUG = 'unassigned';

/**
 * What the board's address narrows it to, as ids: the project's slug turned
 * into its id, and the goal. A slug no project has filters to nothing rather
 * than everything, so a stale link does not pretend to be All projects.
 */
export function useBoardFilter(): BoardFilter & { projectSlug?: string } {
  const { project, goal } = board.useSearch();
  const { data: projectId } = useProjects({
    select: (rows) =>
      project
        ? (rows.find((row) =>
            project === UNASSIGNED_SLUG ? row.isUnassigned : row.slug === project,
          )?.id ?? '')
        : undefined,
  });
  return {
    projectSlug: project,
    projectId: project ? (projectId ?? '') : undefined,
    goalId: goal,
  };
}
