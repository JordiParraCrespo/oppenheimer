import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { ProjectLookupPort } from '../../projects/application/project-lookup.port';
import type { ProjectEntity } from '../../projects/domain/project.entity';
import { ProjectErrors } from '../../projects/domain/projects.errors';
import { SessionErrors } from '../domain/sessions.errors';

/**
 * The project a session may be put in, or the reason it may not.
 *
 * The two refusals must stay different. A project the caller cannot see (missing, or
 * another workspace's) is **not found**: "archived" would mislead and confirm the id
 * exists. A genuinely retired project is a **conflict**: the caller sees it, and its
 * directory is out of use on every host that held it. That is why the lookup returns
 * archived rows: only a caller holding the row can tell the two apart.
 */
export async function requireActiveProject(
  projects: ProjectLookupPort,
  scope: AccessScope,
  projectId: string,
): Promise<ProjectEntity> {
  const found = await projects.findOneById(scope, projectId);
  if (found.isNone()) {
    throw new AppError(ProjectErrors.NOT_FOUND, { detail: `No project with id ${projectId}` });
  }
  const project = found.unwrap();
  if (project.isArchived) {
    throw new AppError(SessionErrors.PROJECT_ARCHIVED, {
      detail: `Project ${project.slug} is archived`,
    });
  }
  return project;
}
