import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { QueryHandlerNotFoundException } from '@nestjs/cqrs/dist/exceptions';
import { AppError } from '@oppenheimer/backend-core';
import { HasOpenSessionsQuery } from '../../../sessions/queries/has-open-sessions/has-open-sessions.query';
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
 * **It fails closed.** "Is any session still open in this project" is a question
 * only the module that owns sessions can answer, and it is asked over the query bus.
 * If nothing is listening — a build without that module — the archive refuses rather
 * than assuming the answer it would prefer. Assuming "no sessions" on a destructive
 * path is the failure mode this shape exists to rule out.
 */
@CommandHandler(ArchiveProjectCommand)
export class ArchiveProjectCommandHandler
  implements ICommandHandler<ArchiveProjectCommand, ProjectEntity>
{
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepositoryPort,
    private readonly queryBus: QueryBus,
  ) {}

  async execute(command: ArchiveProjectCommand): Promise<ProjectEntity> {
    const found = await this.projects.findOneById(command.scope, command.projectId);
    if (found.isNone()) {
      throw new AppError(ProjectErrors.NOT_FOUND, {
        detail: `No project with id ${command.projectId}`,
      });
    }
    const project = found.unwrap();
    // Archiving twice is the same outcome as archiving once, and a retried request
    // after a lost response should not read as a conflict.
    if (project.isArchived) return project;

    if (await this.hasOpenSessions(command)) {
      throw new AppError(ProjectErrors.HAS_OPEN_SESSIONS, {
        detail: `Project ${project.slug} still has sessions that are not closed`,
      });
    }

    project.archive(new Date());
    const archived = await this.projects.archiveIfActive(command.scope, project);
    if (archived.isNone()) {
      throw new AppError(ProjectErrors.NOT_FOUND, {
        detail: `No active project with id ${command.projectId}`,
      });
    }
    return archived.unwrap();
  }

  private async hasOpenSessions(command: ArchiveProjectCommand): Promise<boolean> {
    try {
      return await this.queryBus.execute<HasOpenSessionsQuery, boolean>(
        new HasOpenSessionsQuery({ scope: command.scope, projectId: command.projectId }),
      );
    } catch (error) {
      if (error instanceof QueryHandlerNotFoundException) {
        throw new AppError(ProjectErrors.ARCHIVE_UNAVAILABLE, {
          detail: 'Nothing can answer whether this project still has open sessions',
        });
      }
      throw error;
    }
  }
}
