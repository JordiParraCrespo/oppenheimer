import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { ProjectRepositoryPort } from '../../database/project.repository.port';
import { ProjectErrors } from '../../domain/projects.errors';
import { PROJECT_REPOSITORY } from '../../projects.di-tokens';
import { RestoreProjectCommand, type RestoreProjectResult } from './restore-project.command';

/**
 * Brings an archived project back: work can be listed in it again. The same row
 * returns with its slug, so nothing is reissued and no grant moves. Restoring an
 * active project is the same outcome as restoring an archived one, so a retried
 * request is not a conflict. The automations its archive paused stay paused,
 * for the person to resume.
 */
@CommandHandler(RestoreProjectCommand)
export class RestoreProjectCommandHandler
  implements ICommandHandler<RestoreProjectCommand, RestoreProjectResult>
{
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepositoryPort,
  ) {}

  async execute(command: RestoreProjectCommand): Promise<RestoreProjectResult> {
    const outcome = await this.projects.restoreIfArchived(command.scope, command.projectId);
    if (outcome.result === 'not-found') {
      throw new AppError(ProjectErrors.NOT_FOUND, {
        detail: `No project with id ${command.projectId}`,
      });
    }
    return { project: outcome.project, restored: outcome.result === 'restored' };
  }
}
