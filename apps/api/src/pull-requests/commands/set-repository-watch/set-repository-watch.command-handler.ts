import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { GithubErrors } from '../../../github/domain/github.errors';
import { WatchedRepositoriesResolver } from '../../application/watched-repositories.resolver';
import type { WatchedRepositoryRepositoryPort } from '../../database/watched-repository.repository.port';
import { WATCHED_REPOSITORY_REPOSITORY } from '../../pull-requests.di-tokens';
import { SetRepositoryWatchCommand } from './set-repository-watch.command';

/** Watch a repository, or stop: only one the workspace's installations cover. */
@CommandHandler(SetRepositoryWatchCommand)
export class SetRepositoryWatchCommandHandler
  implements ICommandHandler<SetRepositoryWatchCommand, void>
{
  constructor(
    private readonly watched: WatchedRepositoriesResolver,
    @Inject(WATCHED_REPOSITORY_REPOSITORY)
    private readonly watches: WatchedRepositoryRepositoryPort,
  ) {}

  async execute(command: SetRepositoryWatchCommand): Promise<void> {
    const covered = (await this.watched.all(command.scope)).some(
      ({ repository }) =>
        repository.installationId === command.installationId &&
        repository.githubRepoId === command.githubRepoId,
    );
    if (!covered) {
      throw new AppError(GithubErrors.REPOSITORY_NOT_IN_INSTALLATION, {
        detail: `Repository ${command.githubRepoId} is not covered by this workspace's installations`,
      });
    }
    const watch = { installationId: command.installationId, githubRepoId: command.githubRepoId };
    if (command.watching) await this.watches.watch(command.scope, watch);
    else await this.watches.unwatch(command.scope, watch);
  }
}
