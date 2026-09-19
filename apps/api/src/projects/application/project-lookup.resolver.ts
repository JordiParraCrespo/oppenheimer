import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { Option } from 'oxide.ts';
import type { ProjectRepositoryPort } from '../database/project.repository.port';
import { ProjectEntity } from '../domain/project.entity';
import { projectSlugFromRepositoryName, withSuffix } from '../domain/project-slug.policy';
import { ProjectErrors } from '../domain/projects.errors';
import { PROJECT_REPOSITORY } from '../projects.di-tokens';
import type { ProjectLookupPort, ProjectOrigin } from './project-lookup.port';

/**
 * Bounded, because the loop only runs again when a random suffix collided.
 * Unbounded retries would turn an improbable collision into a hung request.
 */
const MAX_SLUG_ATTEMPTS = 5;

/**
 * Resolves the project a repository belongs to, creating it on first sight.
 *
 * The race is the whole of this class. Two concurrent first sessions on the same
 * repository both find no project and both try to create one, and there is no
 * ordering between them — so each attempt is an insert that may quietly lose,
 * followed by a **re-read** of what is actually there. Nothing here asks
 * "is the slug free?" and then acts on the answer: between the question and the
 * insert the answer can change, which is exactly the bug the database's unique
 * constraint is being used to rule out.
 */
@Injectable()
export class ProjectLookupResolver implements ProjectLookupPort {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepositoryPort,
  ) {}

  async findForRepository(
    scope: AccessScope,
    githubRepoId: number,
  ): Promise<Option<ProjectEntity>> {
    return this.projects.findOneByOrigin(scope, githubRepoId);
  }

  async ensureForRepository(scope: AccessScope, origin: ProjectOrigin): Promise<string> {
    const { organizationId } = scope;
    if (!organizationId) {
      throw new AppError(ProjectErrors.NO_ACTIVE_ORGANIZATION);
    }

    // The common case by a wide margin: every session after the first.
    const existing = await this.projects.findOneByOrigin(scope, origin.githubRepoId);
    if (existing.isSome()) return existing.unwrap().id;

    // `name` starts as the sanitised repository name even when the slug ends up
    // suffixed: the name is display-only and free to change, the slug is not.
    const name = projectSlugFromRepositoryName(origin.repositoryName);
    let slug = name;

    for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt += 1) {
      const project = ProjectEntity.createNew({
        organizationId,
        name,
        slug,
        originGithubRepoId: origin.githubRepoId,
      });
      if (await this.projects.insertIfSlugAvailable(project)) return project.id;

      // The slug is taken. Either by the project a concurrent create just made
      // for this same repository — in which case that is the project, and this
      // request was simply second…
      const raced = await this.projects.findOneByOrigin(scope, origin.githubRepoId);
      if (raced.isSome()) return raced.unwrap().id;

      // …or by a project with a different origin: `acme/xrp-mobile` and
      // `other/xrp-mobile` derive the same slug, and both want a directory.
      slug = withSuffix(name);
    }

    throw new AppError(ProjectErrors.SLUG_UNAVAILABLE, {
      detail: `Could not reserve a directory name derived from ${origin.repositoryName} after ${MAX_SLUG_ATTEMPTS} attempts`,
    });
  }
}
