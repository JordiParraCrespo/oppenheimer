import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { ProjectSettingsResolver } from '../../application/project-settings.resolver';
import type { ProjectRepositoryPort } from '../../database/project.repository.port';
import type { ProjectEntity } from '../../domain/project.entity';
import { ProjectErrors } from '../../domain/projects.errors';
import { PROJECT_REPOSITORY } from '../../projects.di-tokens';
import { UpdateProjectCommand } from './update-project.command';

/**
 * Changes what a person may change about a project: its name, its repositories as
 * a whole set, its defaults and its instructions. Never the slug — it is the
 * project's stable handle, and the aggregate offers no way to change it.
 *
 * Editing a project never reaches into a session: what a session checked out is
 * on its own checkout rows, and a session keeps the instructions it was launched
 * with.
 *
 * Returns the saved aggregate rather than its id: the handler has the stored row
 * in hand, and making the controller ask the bus for it again would be a second
 * scoped round-trip to rebuild what this one just read.
 */
@CommandHandler(UpdateProjectCommand)
export class UpdateProjectCommandHandler
  implements ICommandHandler<UpdateProjectCommand, ProjectEntity>
{
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepositoryPort,
    private readonly settings: ProjectSettingsResolver,
  ) {}

  async execute({ scope, projectId, changes }: UpdateProjectCommand): Promise<ProjectEntity> {
    const found = await this.projects.findOneById(scope, projectId);
    if (found.isNone()) {
      throw new AppError(ProjectErrors.NOT_FOUND, { detail: `No project with id ${projectId}` });
    }

    await this.settings.assertUsableHost(scope, changes.defaultHostId);
    const repositories = changes.repositories
      ? await this.settings.repositories(scope, changes.repositories)
      : undefined;

    // Through the aggregate, so every field is validated by the same invariants a
    // creation goes through, then written as a targeted update: the row is the
    // authority on whether the project is still active.
    const project = found.unwrap();
    project.configure({
      name: changes.name,
      repositories,
      defaultHostId: changes.defaultHostId,
      defaultAgent: changes.defaultAgent,
      instructions: changes.instructions,
    });

    const saved = await this.projects.saveSettingsIfActive(scope, project);
    if (saved.isNone()) {
      throw new AppError(ProjectErrors.NOT_FOUND, {
        detail: `No active project with id ${projectId}`,
      });
    }
    return saved.unwrap();
  }
}
