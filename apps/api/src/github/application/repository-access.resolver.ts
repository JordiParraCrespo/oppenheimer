import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import type { GithubInstallationRepositoryPort } from '../database/github-installation.repository.port';
import { GithubErrors } from '../domain/github.errors';
import { GITHUB_APP, GITHUB_INSTALLATION_REPOSITORY } from '../github.di-tokens';
import type { GithubAppPort } from '../infrastructure/github-app.port';
import type { RepositoryAccessPort, RepositoryToken } from './repository-access.port';

/**
 * Turns a checkout's two ids into a credential for one repository.
 *
 * It lives in `application/` rather than in a slice because no route reaches it:
 * it is what the relay calls when a runner asks for a credential, and what the
 * session dispatcher seals into a job. It needs ports, it is not a use case.
 *
 * **Nothing here is cached, and no token is stored.** GitHub already gives the
 * token an hour and the runner holds it in memory for that hour, so a cache here
 * would buy nothing and cost the one property the design turns on: a mint is a
 * live call, so it fails the moment the repository leaves the installation or
 * the App's permissions narrow. A cached secret would keep a removed repository
 * working until its TTL — which is the "in our copy but the mint fails" failure
 * mode this module exists without, wearing a Redis key instead of a table.
 */
@Injectable()
export class RepositoryAccessResolver implements RepositoryAccessPort {
  constructor(
    @Inject(GITHUB_INSTALLATION_REPOSITORY)
    private readonly installations: GithubInstallationRepositoryPort,
    @Inject(GITHUB_APP)
    private readonly github: GithubAppPort,
  ) {}

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
