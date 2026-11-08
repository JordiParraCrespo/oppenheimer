import type { ProjectEntity } from '@oppenheimer/frontend-consumer';

/** How Plan's `?project=` names a project: its slug, or `unassigned` for the workspace's Unassigned. */
export function planProjectParam(project: Pick<ProjectEntity, 'isUnassigned' | 'slug'>): string {
  return project.isUnassigned ? 'unassigned' : project.slug;
}
