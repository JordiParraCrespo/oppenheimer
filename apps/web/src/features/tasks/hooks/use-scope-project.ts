import { useProjects } from '@oppenheimer/frontend-consumer/react';
import { useRouterState } from '@tanstack/react-router';
import { projectIdsOfSlugs, projectSlugsOf } from '../lib/plan-scope';

/**
 * The projects the Plan view in the address is narrowed to: their slugs from
 * `?project=` and the ids they name (`''` for a slug no project has; absent
 * for All projects). Read from the location rather than one route, so the
 * sidebar and every Plan view ask the same way.
 */
export function useScopeProject(): { slugs: string[]; projectIds?: readonly string[] } {
  const param = useRouterState({
    select: (state) => (state.location.search as { project?: unknown }).project,
  });
  const slugs = projectSlugsOf(typeof param === 'string' ? param : undefined);
  const { data: projectIds } = useProjects({ select: (rows) => projectIdsOfSlugs(slugs, rows) });
  return { slugs, projectIds: slugs.length ? (projectIds ?? ['']) : undefined };
}
