import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import type { GithubInstallationRepositoryPort } from '../../database/github-installation.repository.port';
import { GithubErrors } from '../../domain/github.errors';
import { GITHUB_APP, GITHUB_INSTALLATION_REPOSITORY } from '../../github.di-tokens';
import type { GithubAppPort, GithubRepository } from '../../infrastructure/github-app.port';
import { ListInstallationRepositoriesQuery } from './list-installation-repositories.query';

/**
 * The repository list is never stored: GitHub owns it, the installation is the
 * access control GitHub enforces, and a repository that leaves it simply stops
 * appearing here (`product/versions/mvp/03-control-plane.md`).
 *
 * The one-minute Redis key is this module's only answer to "what does this
 * installation cover", and it is only ever read here — the branch listing
 * resolves its one repository through GitHub rather than through a second copy
 * of this list, and the token mint never consults it at all. So it is a cache of
 * a picker's page, not a mirror that anything authorises against.
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
    private readonly configService: ConfigService,
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
    return this.cache.getOrSet(`github:repositories:${installation.id}`, this.cacheTtlSeconds, () =>
      this.github.listInstallationRepositories(installation.githubInstallationId),
    );
  }

  /**
   * Long enough that typing in the picker does not hit GitHub on every keystroke,
   * short enough that a repository created a minute ago is there.
   */
  private get cacheTtlSeconds(): number {
    return this.configService.getOrThrow<number>('githubApp.repositoriesCacheTtlSeconds');
  }
}
