import { Inject, Injectable } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import type { GithubInstallationRepositoryPort } from '../database/github-installation.repository.port';
import { GithubErrors } from '../domain/github.errors';
import { GITHUB_APP, GITHUB_INSTALLATION_REPOSITORY } from '../github.di-tokens';
import type { GithubAppPort } from '../infrastructure/github-app.port';
import type { RepositoryAccessPort, RepositoryToken } from './repository-access.port';

/** Just under GitHub's one-hour lifetime, so a cached token is never spent. */
const CACHE_TTL_SECONDS = 55 * 60;

/** What Redis holds: the same token with a JSON-safe expiry. */
interface CachedToken {
  token: string;
  expiresAt: string;
}

/**
 * Turns a checkout's two ids into a credential for one repository.
 *
 * It lives in `application/` rather than in a slice because no route reaches it:
 * it is what the relay calls when a runner asks for a credential, and what the
 * session dispatcher seals into a job. It needs ports, it is not a use case.
 *
 * Installation access tokens are **not rows**. They are minted from the App key
 * on demand and cached in Redis until shortly before expiry, which makes "the
 * platform holds no long-lived repository credential" a structural fact rather
 * than a rule someone has to remember.
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
    // so here is what turns GitHub's opaque 401 into an answer the console and
    // the runner can act on.
    if (!installation.isUsable) {
      throw new AppError(GithubErrors.INSTALLATION_SUSPENDED, {
        detail: `Installation ${installation.accountLogin} is suspended or no longer installed`,
        extensions: { installationId },
      });
    }

    const key = cacheKey(installationId, githubRepoId);
    const cached = await this.cache.get<CachedToken>(key);
    if (cached) {
      return { token: cached.token, expiresAt: new Date(cached.expiresAt), githubRepoId };
    }

    const minted = await this.github.mintRepositoryToken(
      installation.githubInstallationId,
      githubRepoId,
    );
    await this.cache.set<CachedToken>(
      key,
      { token: minted.token, expiresAt: minted.expiresAt.toISOString() },
      CACHE_TTL_SECONDS,
    );

    return { token: minted.token, expiresAt: minted.expiresAt, githubRepoId };
  }
}

/**
 * Keyed on the control-plane installation id and the repository, never on
 * anything derived from the token: a secret in a cache key is a secret in every
 * `KEYS` listing and every slow-log line.
 */
function cacheKey(installationId: string, githubRepoId: number): string {
  return `github:token:${installationId}:${githubRepoId}`;
}
