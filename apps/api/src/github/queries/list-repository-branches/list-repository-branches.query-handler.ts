import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { GithubInstallationRepositoryPort } from '../../database/github-installation.repository.port';
import { GithubErrors } from '../../domain/github.errors';
import { GITHUB_APP, GITHUB_INSTALLATION_REPOSITORY } from '../../github.di-tokens';
import type { GithubAppPort, GithubBranch } from '../../infrastructure/github-app.port';
import { ListRepositoryBranchesQuery } from './list-repository-branches.query';

/**
 * Live, and deliberately uncached: a branch list is read once when a checkout is
 * being created, and a branch pushed seconds ago is exactly the one the person is
 * looking for. The adapter resolves the repository through the installation's own
 * listing first, so a repository the installation does not cover is refused here
 * rather than reached on GitHub.
 */
@QueryHandler(ListRepositoryBranchesQuery)
export class ListRepositoryBranchesQueryHandler
  implements
    IQueryHandler<ListRepositoryBranchesQuery, { branches: GithubBranch[]; defaultBranch: string }>
{
  constructor(
    @Inject(GITHUB_INSTALLATION_REPOSITORY)
    private readonly installations: GithubInstallationRepositoryPort,
    @Inject(GITHUB_APP)
    private readonly github: GithubAppPort,
  ) {}

  async execute(
    query: ListRepositoryBranchesQuery,
  ): Promise<{ branches: GithubBranch[]; defaultBranch: string }> {
    const found = await this.installations.findOneById(query.scope, query.installationId);
    if (found.isNone()) {
      throw new AppError(GithubErrors.INSTALLATION_NOT_FOUND, {
        detail: `No GitHub installation with id ${query.installationId}`,
      });
    }

    const installation = found.unwrap();
    if (!installation.isUsable) {
      throw new AppError(GithubErrors.INSTALLATION_SUSPENDED, {
        detail: `Installation ${installation.accountLogin} is suspended or no longer installed`,
      });
    }

    return this.github.listRepositoryBranches(
      installation.githubInstallationId,
      query.githubRepoId,
    );
  }
}
