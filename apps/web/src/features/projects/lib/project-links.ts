import type { ProjectEntity } from '@oppenheimer/frontend-consumer';

/** How Plan's `?project=` names a project: its slug, or `unassigned` for the workspace's Unassigned. */
export function planProjectParam(project: Pick<ProjectEntity, 'isUnassigned' | 'slug'>): string {
  return project.isUnassigned ? 'unassigned' : project.slug;
}

/** A calendar day (`YYYY-MM-DD`) as a local date, so formatting it never shifts it by a timezone. */
export function dayOf(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}
