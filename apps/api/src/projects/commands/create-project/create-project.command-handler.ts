import { randomUUID } from 'node:crypto';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { ProjectSettingsResolver } from '../../application/project-settings.resolver';
import type { ProjectRepositoryPort } from '../../database/project.repository.port';
import { ProjectEntity } from '../../domain/project.entity';
import { projectSlugCandidates } from '../../domain/project-slug.policy';
import { ProjectErrors } from '../../domain/projects.errors';
import { PROJECT_REPOSITORY } from '../../projects.di-tokens';
import { CreateProjectCommand } from './create-project.command';

/**
 * Creates a project a person asked for: a name, the repositories it holds and the
 * defaults a new session is offered (`product/versions/mvp/10-api-modules-and-data-model.md`).
 * The only other project is the workspace's Unassigned, which it is given.
 *
 * The slug is derived from the name, once. The id is minted first so the fallback slug
 * derives from the row itself; the only race is the slug, and the database's unique
 * constraint answers it rather than a check-then-act here.
 */
@CommandHandler(CreateProjectCommand)
export class CreateProjectCommandHandler
  implements ICommandHandler<CreateProjectCommand, ProjectEntity>
{
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepositoryPort,
    private readonly settings: ProjectSettingsResolver,
  ) {}

  async execute({ scope, input }: CreateProjectCommand): Promise<ProjectEntity> {
    const { organizationId } = scope;
    if (!organizationId) throw new AppError(ProjectErrors.NO_ACTIVE_ORGANIZATION);

    await this.settings.assertUsableHost(scope, input.defaultHostId);
    const repositories = await this.settings.repositories(scope, input.repositories);

    const id = randomUUID();
    for (const slug of projectSlugCandidates(input.name, id)) {
      const project = ProjectEntity.createNew({
        id,
        organizationId,
        name: input.name,
        slug,
        repositories,
        createdByUserId: scope.userId,
        defaultHostId: input.defaultHostId ?? null,
        defaultAgent: input.defaultAgent ?? null,
      });
      if ((await this.projects.insert(project)) === 'inserted') return project;
    }

    throw new AppError(ProjectErrors.SLUG_UNAVAILABLE, {
      detail: `Every slug derived from “${input.name}” is taken`,
    });
  }
}
