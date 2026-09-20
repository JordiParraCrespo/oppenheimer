import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { Option } from 'oxide.ts';
import type { ProjectRepositoryPort } from '../database/project.repository.port';
import { ProjectEntity } from '../domain/project.entity';
import { projectSlugCandidates } from '../domain/project-slug.policy';
import { ProjectErrors } from '../domain/projects.errors';
import { PROJECT_REPOSITORY } from '../projects.di-tokens';
import type { ProjectLookupPort, ProjectOrigin } from './project-lookup.port';

/**
 * Resolves the project a repository belongs to, creating it on first sight.
 *
 * The race is the whole of this class, and it has **two** shapes that must not be
 * confused:
 *
 *  - two first sessions on the *same* repository. They collide on the origin,
 *    which is unique, so one insert lands and the other is told so and reads the
 *    winner. Both callers get the same project.
 *  - two *different* repositories deriving the same directory name
 *    (`acme/xrp-mobile` and `other/xrp-mobile`). They collide on the slug, and
 *    the loser moves to the next candidate — `<owner>--<repo>`, then
 *    `<owner>--<repo>-<githubRepoId>`, all derived from the repository, so the
 *    list is short and cannot be exhausted.
 *
 * Nothing here asks whether a name is free and then acts on the answer: between
 * the question and the insert the answer can change, which is what the database's
 * two unique constraints are being used to rule out.
 */
@Injectable()
export class ProjectLookupResolver implements ProjectLookupPort {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepositoryPort,
  ) {}

  async findForRepository(
    scope: AccessScope,
    githubRepoId: string,
  ): Promise<Option<ProjectEntity>> {
    return this.projects.findOneByOrigin(scope, githubRepoId);
  }

  async ensureForRepository(scope: AccessScope, origin: ProjectOrigin): Promise<ProjectEntity> {
    const { organizationId } = scope;
    if (!organizationId) {
      throw new AppError(ProjectErrors.NO_ACTIVE_ORGANIZATION);
    }

    // The common case by a wide margin: every session after the first.
    const existing = await this.projects.findOneByOrigin(scope, origin.githubRepoId);
    if (existing.isSome()) return existing.unwrap();

    for (const slug of projectSlugCandidates(origin)) {
      const project = ProjectEntity.createNew({
        organizationId,
        // The display name is the repository's own, as GitHub spells it, whichever
        // candidate the directory ends up being.
        name: origin.name,
        slug,
        originGithubRepoId: origin.githubRepoId,
      });

      const outcome = await this.projects.insertIfUnclaimed(project);
      if (outcome === 'inserted') return project;
      // Somebody else created this repository's project while we were deriving a
      // name for it. Theirs is the project; this request was simply second.
      if (outcome === 'origin-taken') return await this.reread(scope, origin);
      // Otherwise the directory name belongs to another repository: try the next
      // candidate rather than adopting a stranger's project.
    }

    // The last candidate carries GitHub's own repository id, so reaching here
    // means the origin was claimed between the read above and the last insert.
    return await this.reread(scope, origin);
  }

  /** The project that won, read back by the identity both racers used. */
  private async reread(scope: AccessScope, origin: ProjectOrigin): Promise<ProjectEntity> {
    const winner = await this.projects.findOneByOrigin(scope, origin.githubRepoId);
    if (winner.isNone()) {
      throw new AppError(ProjectErrors.NOT_FOUND, {
        detail: `No project for GitHub repository ${origin.githubRepoId}`,
      });
    }
    return winner.unwrap();
  }
}
