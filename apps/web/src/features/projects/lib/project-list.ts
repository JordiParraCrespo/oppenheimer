import type { ProjectEntity } from '@oppenheimer/frontend-consumer';
import type { TFunction } from 'i18next';

/**
 * What a row of Plan's Projects says under a project's name: its
 * repositories by short name with their count as the tag, or that it has
 * none and no tag.
 */
export function projectListMeta(
  project: Pick<ProjectEntity, 'repositories' | 'shortName'>,
  t: TFunction,
): { meta: string; kind?: string } {
  const count = project.repositories.length;
  if (count === 0) return { meta: t('projects.list.noRepositories') };
  return { meta: project.shortName, kind: t('projects.list.repositories', { count }) };
}
