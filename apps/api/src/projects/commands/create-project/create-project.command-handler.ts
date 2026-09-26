import { randomUUID } from 'node:crypto';
import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { ProjectSettingsResolver } from '../../application/project-settings.resolver';
import type { ProjectRepositoryPort } from '../../database/project.repository.port';
import { ProjectEntity } from '../../domain/project.entity';
import { projectSlugCandidatesFromName } from '../../domain/project-slug.policy';
import { ProjectErrors } from '../../domain/projects.errors';
import { PROJECT_REPOSITORY } from '../../projects.di-tokens';
import { CreateProjectCommand } from './create-project.command';

/**
 * Creates a project a person asked for: a name, the repositories it holds and the
 * defaults a new session is offered (`product/versions/mvp/12-projects.md`).
 *
 * The slug is derived from the **name**, once. The id is minted first so the
 * fallback candidate can be derived from the row itself; the only race is the
 * directory name, and the database's unique constraint is what answers it —
 * nothing here asks whether a name is free and then acts on the answer.
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
    for (const slug of projectSlugCandidatesFromName(input.name, id)) {
      const project = ProjectEntity.createNew({
        id,
        organizationId,
        name: input.name,
        slug,
        repositories,
        createdByUserId: scope.userId,
        defaultHostId: input.defaultHostId ?? null,
        defaultAgent: input.defaultAgent ?? null,
        instructions: input.instructions ?? '',
      });
      if ((await this.projects.insertNamed(project)) === 'inserted') return project;
    }

    // The last candidate carries the project's own id, so this is not a name
    // somebody else is using by accident; report it rather than loop.
    throw new AppError(ProjectErrors.SLUG_UNAVAILABLE, {
      detail: `Every directory name derived from “${input.name}” is taken`,
    });
  }
}
