import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import type { GithubInstallationRepositoryPort } from '../../database/github-installation.repository.port';
import { GithubErrors } from '../../domain/github.errors';
import { GITHUB_APP, GITHUB_INSTALLATION_REPOSITORY } from '../../github.di-tokens';
import type { GithubAppPort, GithubRepository } from '../../infrastructure/github-app.port';
import { ListInstallationRepositoriesQuery } from './list-installation-repositories.query';

/**
 * Long enough that typing in the picker does not hit GitHub on every keystroke,
 * short enough that a repository created a minute ago is there.
 */
const CACHE_TTL_SECONDS = 60;

/**
 * The one-minute Redis key is read only here; the branch listing and the token
 * mint go to GitHub. It is a cache of a picker's page, not a mirror anything
 * authorises against.
 */
@QueryHandler(ListInstallationRepositoriesQuery)
export class ListInstallationRepositoriesQueryHandler
  implements IQueryHandler<ListInstallationRepositoriesQuery, GithubRepository[]>
{
  constructor(
    @Inject(GITHUB_INSTALLATION_REPOSITORY)
    private readonly installations: GithubInstallationRepositoryPort,
    @Inject(GITHUB_APP)
    private readonly github: GithubAppPort,
    private readonly cache: CacheService,
  ) {}

  async execute(query: ListInstallationRepositoriesQuery): Promise<GithubRepository[]> {
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

    // Single-flight: when the entry expires under a picker's keystrokes, the
    // requests in flight share one GitHub listing instead of each paginating
    // the whole installation.
    return this.cache.getOrSet(`github:repositories:${installation.id}`, CACHE_TTL_SECONDS, () =>
      this.github.listInstallationRepositories(installation.githubInstallationId),
    );
  }
}
