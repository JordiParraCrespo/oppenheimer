import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import type { GithubInstallationRepositoryPort } from '../database/github-installation.repository.port';
import { GithubErrors } from '../domain/github.errors';
import { GITHUB_APP, GITHUB_INSTALLATION_REPOSITORY } from '../github.di-tokens';
import type { GithubAppPort, GithubRepository } from '../infrastructure/github-app.port';
import type { RepositoryAccessPort, RepositoryToken } from './repository-access.port';

/**
 * How long GitHub's answer about a repository is reused. Short enough that a
 * rename or a new default branch is picked up while someone is still looking at
 * the console, long enough that a burst of session starts costs one call.
 */
const REPOSITORY_TTL_SECONDS = 60;

function repositoryCacheKey(githubInstallationId: string | number, githubRepoId: number): string {
  return `github:repository:${githubInstallationId}:${githubRepoId}`;
}

/**
 * It lives in `application/` rather than in a slice because no route reaches it:
 * it is what the relay mints a runner's credential through, and what a session,
 * automation or project reads a repository through. It needs ports, it is not a
 * use case.
 */
@Injectable()
export class RepositoryAccessResolver implements RepositoryAccessPort {
  constructor(
    @Inject(GITHUB_INSTALLATION_REPOSITORY)
    private readonly installations: GithubInstallationRepositoryPort,
    @Inject(GITHUB_APP)
    private readonly github: GithubAppPort,
    private readonly cache: CacheService,
  ) {}

  async repositoryOf(
    scope: AccessScope,
    installationId: string,
    githubRepoId: number,
  ): Promise<GithubRepository> {
    const found = await this.installations.findOneById(scope, installationId);
    if (found.isNone()) {
      throw new AppError(GithubErrors.INSTALLATION_NOT_FOUND, {
        detail: `No GitHub installation with id ${installationId}`,
      });
    }
    const installation = found.unwrap();
    if (!installation.isUsable) {
      throw new AppError(GithubErrors.INSTALLATION_SUSPENDED, {
        detail: `Installation ${installation.accountLogin} is suspended or no longer installed`,
      });
    }
    // A repository's name and default branch, from GitHub, was the single
    // most expensive step of starting a session: about seven hundred
    // milliseconds of the second the console spent before the host heard
    // anything, spent on two fields that change about never.
    //
    // What authorises this read is the installation lookup above, and that
    // stays live on every call: the cache holds only GitHub's answer about the
    // repository, keyed by the installation that may see it. `getOrSet` also
    // collapses concurrent asks for the same repository into one call, which
    // is what two sessions started together do.
    return this.cache.getOrSet(
      repositoryCacheKey(installation.githubInstallationId, githubRepoId),
      REPOSITORY_TTL_SECONDS,
      () => this.github.readRepository(installation.githubInstallationId, githubRepoId),
    );
  }

  async mintRepositoryToken(
    installationId: string,
    githubRepoId: number,
  ): Promise<RepositoryToken> {
    const found = await this.installations.findOneByIdForTokenMint(installationId);
    if (found.isNone()) {
      throw new AppError(GithubErrors.INSTALLATION_NOT_FOUND, {
        detail: `No GitHub installation with id ${installationId}`,
      });
    }

    const installation = found.unwrap();
    // A suspended or uninstalled installation would mint nothing anyway; saying
    // so here is what turns GitHub's opaque refusal into an answer the console
    // and the runner can act on.
    if (!installation.isUsable) {
      throw new AppError(GithubErrors.INSTALLATION_SUSPENDED, {
        detail: `Installation ${installation.accountLogin} is suspended or no longer installed`,
        extensions: { installationId },
      });
    }

    const minted = await this.github.mintRepositoryToken(
      installation.githubInstallationId,
      githubRepoId,
    );

    return { token: minted.token, expiresAt: minted.expiresAt, githubRepoId };
  }
}
