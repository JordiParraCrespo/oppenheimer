import { searchText } from '@oppenheimer/frontend-web';
import { z } from 'zod';

/**
 * The project a Plan view is narrowed to, by slug (`unassigned` for the
 * workspace's Unassigned project). The board, Milestones and Stats all read
 * it, so the sidebar's project list keeps the reader on the view they are on.
 */
export const planScopeSearchSchema = z.object({ project: searchText });
export type PlanScopeSearch = z.infer<typeof planScopeSearchSchema>;

/** `?project=unassigned` names the workspace's Unassigned project, which has no slug of its own to show. */
export const UNASSIGNED_SLUG = 'unassigned';

/**
 * The project id a slug names. A slug no project has resolves to `''`, which
 * matches nothing, so a stale link filters to nothing rather than to everything.
 */
export function projectIdOfSlug(
  slug: string | undefined,
  projects: readonly { id: string; slug: string; isUnassigned: boolean }[],
): string | undefined {
  if (!slug) return undefined;
  return (
    projects.find((row) => (slug === UNASSIGNED_SLUG ? row.isUnassigned : row.slug === slug))?.id ??
    ''
  );
}
