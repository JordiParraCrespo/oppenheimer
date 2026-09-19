import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { ProjectRepositoryPort } from '../../database/project.repository.port';
import type { ProjectEntity } from '../../domain/project.entity';
import { ProjectErrors } from '../../domain/projects.errors';
import { PROJECT_REPOSITORY } from '../../projects.di-tokens';
import { UpdateProjectCommand } from './update-project.command';

/**
 * Renames a project. Display only — the slug is a directory name on every host
 * holding the project and the aggregate offers no way to change it.
 *
 * Returns the renamed aggregate rather than its id: the handler has the stored
 * row in hand, and making the controller ask the bus for it again would be a
 * second scoped round-trip to rebuild what this one just read.
 */
@CommandHandler(UpdateProjectCommand)
export class UpdateProjectCommandHandler
  implements ICommandHandler<UpdateProjectCommand, ProjectEntity>
{
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepositoryPort,
  ) {}

  async execute(command: UpdateProjectCommand): Promise<ProjectEntity> {
    const found = await this.projects.findOneById(command.scope, command.projectId);
    if (found.isNone()) {
      throw new AppError(ProjectErrors.NOT_FOUND, {
        detail: `No project with id ${command.projectId}`,
      });
    }

    // Through the aggregate, so the name is validated by the same invariants a
    // creation goes through, then written as a targeted update: the row is the
    // authority on whether the project is still active.
    const project = found.unwrap();
    project.rename(command.name);

    const renamed = await this.projects.renameIfActive(command.scope, project);
    if (renamed.isNone()) {
      throw new AppError(ProjectErrors.NOT_FOUND, {
        detail: `No active project with id ${command.projectId}`,
      });
    }
    return renamed.unwrap();
  }
}
