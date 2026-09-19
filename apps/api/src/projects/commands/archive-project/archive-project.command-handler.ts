import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { ProjectUsagePort } from '../../application/project-usage.port';
import type { ProjectRepositoryPort } from '../../database/project.repository.port';
import { ProjectErrors } from '../../domain/projects.errors';
import { PROJECT_REPOSITORY, PROJECT_USAGE } from '../../projects.di-tokens';
import { ArchiveProjectCommand } from './archive-project.command';

/**
 * Retires a project. The row stays, so the slug it holds is never reissued and
 * no later project can inherit its directory — and with it another project's
 * agent history.
 */
@CommandHandler(ArchiveProjectCommand)
export class ArchiveProjectCommandHandler implements ICommandHandler<ArchiveProjectCommand, void> {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projects: ProjectRepositoryPort,
    @Inject(PROJECT_USAGE)
    private readonly usage: ProjectUsagePort,
  ) {}

  async execute(command: ArchiveProjectCommand): Promise<void> {
    const found = await this.projects.findOneById(command.scope, command.projectId);
    if (found.isNone()) {
      throw new AppError(ProjectErrors.NOT_FOUND, {
        detail: `No project with id ${command.projectId}`,
      });
    }

    // Refuse rather than cascade: the sessions inside a project own worktrees on
    // a host, and closing them is work with its own failure modes.
    if (await this.usage.hasOpenSessions(command.projectId)) {
      throw new AppError(ProjectErrors.HAS_OPEN_SESSIONS, {
        detail: 'Close the sessions in this project before archiving it',
        extensions: { projectId: command.projectId },
      });
    }

    const project = found.unwrap();
    project.archive();
    await this.projects.save(project);
  }
}
