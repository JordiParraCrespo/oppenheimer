import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { GithubErrors } from '../../../github/domain/github.errors';
import { addressKeyOf } from '../../../github/domain/repository-address.policy';
import { WatchedRepositoriesResolver } from '../../application/watched-repositories.resolver';
import type { WatchedRepositoryRepositoryPort } from '../../database/watched-repository.repository.port';
import { WATCHED_REPOSITORY_REPOSITORY } from '../../pull-requests.di-tokens';
import { SetRepositoryWatchCommand } from './set-repository-watch.command';

/** Watch a repository, or stop: only one the workspace's installations cover or the caller's tokens open. */
@CommandHandler(SetRepositoryWatchCommand)
export class SetRepositoryWatchCommandHandler
  implements ICommandHandler<SetRepositoryWatchCommand, void>
{
  constructor(
    private readonly watched: WatchedRepositoriesResolver,
    @Inject(WATCHED_REPOSITORY_REPOSITORY)
    private readonly watches: WatchedRepositoryRepositoryPort,
  ) {}

  async execute({ scope, repository, watching }: SetRepositoryWatchCommand): Promise<void> {
    const key = addressKeyOf(repository);
    const covered = (await this.watched.all(scope)).some(
      (entry) => addressKeyOf(entry.repository) === key,
    );
    if (!covered) {
      throw new AppError(GithubErrors.REPOSITORY_NOT_IN_INSTALLATION, {
        detail: `Repository ${repository.githubRepoId} is not covered by this workspace's installations or opened by your tokens`,
      });
    }
    if (watching) {
      await this.watches.watch(scope, repository);
      return;
    }
    await this.watches.unwatch(scope, repository);
    // A watch made through a token counts for the installation that now covers
    // the repository, so stopping it there stops that one too.
    if (repository.kind === 'installation') {
      await this.watches.unwatch(scope, { kind: 'tokens', githubRepoId: repository.githubRepoId });
    }
  }
}
