import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { ProjectUsageResolver } from '../../application/project-usage.resolver';
import type { ProjectRepositoryPort } from '../../database/project.repository.port';
import type { ProjectEntity } from '../../domain/project.entity';
import { ProjectErrors } from '../../domain/projects.errors';
import { PROJECT_REPOSITORY } from '../../projects.di-tokens';
import { ArchiveProjectCommand } from './archive-project.command';

/**
 * Retires a project: its directory name leaves circulation and nothing new can be
 * put in it. The row is never deleted — `uq (organizationId, slug)` is a permanent
 * tombstone, so a new project can never inherit a retired one's directory and the
 * grants keyed on its id can never be inherited with it.
 *
 * **It fails closed, and that is a DI fact rather than a caught exception.** "Is
 * any session still open in this project" is a question only the module that owns
 * sessions can answer, and it answers it by contributing a `ProjectUsagePort`. With
 * nothing contributed there is no implementation and the archive refuses; assuming
 * "no sessions" on a destructive path is the fail-open this shape rules out.
 *
 * **The check and the write are one transaction.** The repository takes
 * `SELECT … FOR UPDATE` on the project row, asks the question inside that lock and
 * writes `archivedAt` before releasing it, while creating a session takes a share
 * lock on the same row. So an archive and a create cannot both win: whichever waits
 * sees the other's committed work and refuses.
 */
@CommandHandler(ArchiveProjectCommand)
export class ArchiveProjectCommandHandler
  implements ICommandHandler<ArchiveProjectCommand, ProjectEntity>
{
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepositoryPort,
    private readonly usage: ProjectUsageResolver,
  ) {}

  async execute(command: ArchiveProjectCommand): Promise<ProjectEntity> {
    const usage = this.usage.current();
    if (!usage) {
      throw new AppError(ProjectErrors.ARCHIVE_UNAVAILABLE, {
        detail: 'Nothing in this deployment can say whether the project still has open sessions',
      });
    }

    const outcome = await this.projects.archiveIfUnused(command.scope, command.projectId, () =>
      usage.hasUnresolvedSessions(command.scope, command.projectId),
    );

    switch (outcome.result) {
      case 'not-found':
        throw new AppError(ProjectErrors.NOT_FOUND, {
          detail: `No project with id ${command.projectId}`,
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
