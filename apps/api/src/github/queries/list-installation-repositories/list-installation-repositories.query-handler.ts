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
 * The repository list is never stored: GitHub owns it, the installation is the
 * boundary GitHub enforces, and a repository that leaves the installation simply
 * stops appearing here (`product/09-github-app-install.md`). The cache is a
 * single Redis key per installation, not a mirror — it cannot drift into a state
 * where a repository is "in our copy but the mint fails".
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

    const key = `github:repositories:${installation.id}`;
    const cached = await this.cache.get<GithubRepository[]>(key);
    if (cached) return cached;

    const repositories = await this.github.listInstallationRepositories(
      installation.githubInstallationId,
    );
    await this.cache.set(key, repositories, CACHE_TTL_SECONDS);
    return repositories;
  }
}
