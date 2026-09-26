import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { ProjectRepositoriesResolver } from '../../application/project-repositories.resolver';
import type { ProjectRepositoryPort } from '../../database/project.repository.port';
import { ProjectEntity } from '../../domain/project.entity';
import type { ProjectRepositoryEntity } from '../../domain/project-repository.entity';
import {
  projectSlugCandidates,
  projectSlugFromRepositoryName,
} from '../../domain/project-slug.policy';
import { ProjectErrors } from '../../domain/projects.errors';
import { PROJECT_REPOSITORY } from '../../projects.di-tokens';
import { CreateProjectCommand } from './create-project.command';

/**
 * A project made on the console (`product/versions/mvp/12-projects-on-the-console.md`).
 *
 * The repositories and the host are confirmed first, because they are the
 * fields somebody else's answer can refuse; the slug is derived from what
 * they confirmed — the first default repository, else the first repository,
 * else the name — through the same candidates a first session uses, so the
 * directory can still be read back to what named it.
 *
 * **No origin.** The origin is the identity of an auto-created project ("this
 * repository's project"), and the partial unique on it must keep answering
 * that question for API callers that send checkouts without a project. A
 * project made here is found by id, and two of them may hold one repository.
 * That also means the insert can only be refused on the slug, and the last
 * candidate carries GitHub's own id, so the loop always ends inserted.
 */
@CommandHandler(CreateProjectCommand)
export class CreateProjectCommandHandler
  implements ICommandHandler<CreateProjectCommand, ProjectEntity>
{
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepositoryPort,
    private readonly resolver: ProjectRepositoriesResolver,
  ) {}

  async execute(command: CreateProjectCommand): Promise<ProjectEntity> {
    const { scope, input } = command;
    if (!scope.organizationId) throw new AppError(ProjectErrors.NO_ACTIVE_ORGANIZATION);

    await this.resolver.assertHost(scope, input.defaultHostId);
    const repositories = await this.resolver.resolveRepositories(scope, input.repositories);

    for (const slug of slugCandidatesFor(input.name, repositories)) {
      const project = ProjectEntity.createNew({
        organizationId: scope.organizationId,
        name: input.name,
        slug,
        defaultHostId: input.defaultHostId ?? null,
        defaultAgent: input.defaultAgent ?? null,
        repositories,
      });
      const outcome = await this.projects.insertIfUnclaimed(project);
      if (outcome === 'inserted') return project;
      // 'origin-taken' cannot happen with no origin; 'slug-taken' means the
      // directory name belongs to another project, so try the next candidate.
    }

    // Unreachable when the project has a repository (the id-suffixed candidate
    // is unique by construction) and a sign, when it has none, that the name
    // itself is a directory somebody already holds.
    throw new AppError(ProjectErrors.NAME_TAKEN, {
      detail: `A project named ${input.name} already holds that directory name`,
    });
  }
}

/** The directory names to try, from what names the project. */
function slugCandidatesFor(
  name: string,
  repositories: readonly ProjectRepositoryEntity[],
): string[] {
  const source = repositories.find((repository) => repository.isDefault) ?? repositories[0];
  if (!source) return [projectSlugFromRepositoryName(name)];
  return projectSlugCandidates({
    owner: source.owner,
    name: source.name,
    githubRepoId: source.githubRepoId,
  });
}
