import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { ProjectRepositoriesResolver } from '../../application/project-repositories.resolver';
import type { ProjectRepositoryPort } from '../../database/project.repository.port';
import type { ProjectEntity } from '../../domain/project.entity';
import { ProjectErrors } from '../../domain/projects.errors';
import { PROJECT_REPOSITORY } from '../../projects.di-tokens';
import { UpdateProjectCommand } from './update-project.command';

/**
 * What the project dialog saves: the name, the defaults and the repository
 * set, each only when given. The repositories and the host go through the
 * same checks a create runs, and the write is one targeted update that the
 * row's own `archivedAt` guards — so a project retired between the read and
 * the write is reported missing, never revived.
 */
@CommandHandler(UpdateProjectCommand)
export class UpdateProjectCommandHandler
  implements ICommandHandler<UpdateProjectCommand, ProjectEntity>
{
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepositoryPort,
    private readonly resolver: ProjectRepositoriesResolver,
  ) {}

  async execute(command: UpdateProjectCommand): Promise<ProjectEntity> {
    const { scope, changes } = command;
    const found = await this.projects.findOneById(scope, command.projectId);
    if (found.isNone()) {
      throw new AppError(ProjectErrors.NOT_FOUND, {
        detail: `No project with id ${command.projectId}`,
      });
    }

    await this.resolver.assertHost(scope, changes.defaultHostId);
    const repositories =
      changes.repositories === undefined
        ? undefined
        : await this.resolver.resolveRepositories(scope, changes.repositories);

    // Through the aggregate, so the change is validated by the same invariants a
    // creation goes through, then written as a targeted update: the row is the
    // authority on whether the project is still active.
    const project = found.unwrap();
    project.change({
      name: changes.name,
      defaultHostId: changes.defaultHostId,
      defaultAgent: changes.defaultAgent,
      repositories,
    });

    const saved = await this.projects.saveIfActive(scope, project);
    if (saved.isNone()) {
      throw new AppError(ProjectErrors.NOT_FOUND, {
        detail: `No active project with id ${command.projectId}`,
      });
    }
    return saved.unwrap();
  }
}
