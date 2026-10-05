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
 * Changes a project's name, its repositories as a whole set and its defaults. Never the
 * slug, the project's stable handle, and never the Unassigned project's name
 * (`PROJECTS_008`). A session's checkout rows are its own, so an edit never reaches
 * one. Returns the aggregate the scoped write read back, sparing the controller a
 * second scoped read.
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

    const project = found.unwrap();
    if (project.isUnassigned && changes.name !== undefined && changes.name !== project.name) {
      throw new AppError(ProjectErrors.UNASSIGNED_FIXED, {
        detail: 'The Unassigned project keeps its name',
      });
    }

    await this.settings.assertUsableHost(scope, changes.defaultHostId);
    const repositories = changes.repositories
      ? await this.settings.repositories(scope, changes.repositories)
      : undefined;

    // Through the aggregate, so every field is validated by the same invariants a
    // creation goes through, then written as a targeted update: the row is the
    // authority on whether the project is still active.
    project.configure({
      name: changes.name,
      repositories,
      defaultHostId: changes.defaultHostId,
      defaultAgent: changes.defaultAgent,
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
