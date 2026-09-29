import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { GithubInstallationRepositoryPort } from '../database/github-installation.repository.port';
import { GithubErrors } from '../domain/github.errors';
import { GITHUB_APP, GITHUB_INSTALLATION_REPOSITORY } from '../github.di-tokens';
import type { GithubAppPort, GithubRepository } from '../infrastructure/github-app.port';
import type { RepositoryAccessPort, RepositoryToken } from './repository-access.port';

/**
 * It lives in `application/` rather than in a slice because no route reaches it:
 * it is what the relay calls when a runner asks for a credential, and what the
 * session dispatcher seals into a job. It needs ports, it is not a use case.
 */
@Injectable()
export class RepositoryAccessResolver implements RepositoryAccessPort {
  constructor(
    @Inject(GITHUB_INSTALLATION_REPOSITORY)
    private readonly installations: GithubInstallationRepositoryPort,
    @Inject(GITHUB_APP)
    private readonly github: GithubAppPort,
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
    return this.github.readRepository(installation.githubInstallationId, githubRepoId);
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
