import { useProjects } from '@oppenheimer/frontend-consumer/react';
import { useRouterState } from '@tanstack/react-router';
import { projectIdOfSlug } from '../lib/plan-scope';

/**
 * The project the Plan view in the address is narrowed to: its slug from
 * `?project=` and the id it names (`''` for a slug no project has). Read from
 * the location rather than one route, so the sidebar and every Plan view ask
 * the same way.
 */
export function useScopeProject(): { slug?: string; projectId?: string } {
  const slug = useRouterState({
    select: (state) => (state.location.search as { project?: unknown }).project,
  });
  const name = typeof slug === 'string' && slug ? slug : undefined;
  const { data: projectId } = useProjects({ select: (rows) => projectIdOfSlug(name, rows) });
  return { slug: name, projectId: name ? (projectId ?? '') : undefined };
}
