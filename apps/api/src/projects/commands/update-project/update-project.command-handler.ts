import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import type { ProjectRepositoryPort } from '../../database/project.repository.port';
import { ProjectErrors } from '../../domain/projects.errors';
import { PROJECT_REPOSITORY } from '../../projects.di-tokens';
import { UpdateProjectCommand } from './update-project.command';

/**
 * Renames a project. Display only — the slug is a directory name on every host
 * holding the project and the aggregate offers no way to change it.
 */
@CommandHandler(UpdateProjectCommand)
export class UpdateProjectCommandHandler
  implements ICommandHandler<UpdateProjectCommand, AggregateID>
{
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepositoryPort,
  ) {}

  async execute(command: UpdateProjectCommand): Promise<AggregateID> {
    const found = await this.projects.findOneById(command.scope, command.projectId);
    if (found.isNone()) {
      throw new AppError(ProjectErrors.NOT_FOUND, {
        detail: `No project with id ${command.projectId}`,
      });
    }

    const project = found.unwrap();
    project.rename(command.name);
    await this.projects.save(project);
    return project.id;
  }
}
