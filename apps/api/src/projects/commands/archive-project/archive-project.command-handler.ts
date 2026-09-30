import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { ProjectUsageRegistry } from '../../application/project-usage.registry';
import type { ProjectRepositoryPort } from '../../database/project.repository.port';
import type { ProjectEntity } from '../../domain/project.entity';
import { ProjectErrors } from '../../domain/projects.errors';
import { PROJECT_REPOSITORY } from '../../projects.di-tokens';
import { ArchiveProjectCommand } from './archive-project.command';

/**
 * Retires a project: nothing new can be listed under it. The row is never deleted:
 * `uq (organizationId, slug)` is a permanent tombstone, so a new project can never
 * inherit a retired one's handle, nor the grants keyed on its id.
 *
 * It fails closed as a DI fact (`ProjectUsagePort`), and the check and the write are
 * one transaction under the project row's lock (`ProjectRepositoryPort.archiveIfUnused`),
 * so an archive and a session create cannot both win.
 */
@CommandHandler(ArchiveProjectCommand)
export class ArchiveProjectCommandHandler
  implements ICommandHandler<ArchiveProjectCommand, ProjectEntity>
{
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepositoryPort,
    private readonly usage: ProjectUsageRegistry,
  ) {}

  async execute(command: ArchiveProjectCommand): Promise<ProjectEntity> {
    if (!this.usage.canAnswer()) {
      throw new AppError(ProjectErrors.ARCHIVE_UNAVAILABLE, {
        detail: 'Nothing in this deployment can say whether the project still has open sessions',
      });
    }

    const outcome = await this.projects.archiveIfUnused(command.scope, command.projectId, () =>
      this.usage.isInUse(command.scope, command.projectId),
    );

    switch (outcome.result) {
      case 'not-found':
        throw new AppError(ProjectErrors.NOT_FOUND, {
          detail: `No project with id ${command.projectId}`,
        });
      case 'unassigned':
        throw new AppError(ProjectErrors.UNASSIGNED_FIXED, {
          detail: 'Sessions that name no project are listed in Unassigned',
        });
      case 'in-use':
        throw new AppError(ProjectErrors.HAS_OPEN_SESSIONS, {
          detail: `Project ${outcome.project.slug} still has sessions that are not closed`,
        });
      default:
        // Archiving twice is the same outcome as archiving once, so a retried
        // request after a lost response is not a conflict.
        return outcome.project;
    }
  }
}
