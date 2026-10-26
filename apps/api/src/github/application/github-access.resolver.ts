import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import type { GithubInstallationRepositoryPort } from '../database/github-installation.repository.port';
import { GithubErrors } from '../domain/github.errors';
import type { GithubInstallationEntity } from '../domain/github-installation.entity';
import { GITHUB_APP, GITHUB_INSTALLATION_REPOSITORY } from '../github.di-tokens';
import type { GithubAppPort } from '../infrastructure/github-app.port';
import type { GithubCredential } from '../infrastructure/github-pulls.port';
import { GithubTokenResolver } from './github-token.resolver';
import { GithubUserGrantResolver } from './github-user-grant.resolver';
import type { RepositoryAddress, WorkspaceRepository } from './pull-request-access.port';

const REPOSITORIES_TTL_SECONDS = 60;
/** An installation token is reused until this close to GitHub's one-hour expiry. */
const TOKEN_MARGIN_MS = 5 * 60_000;

/**
 * What every scoped read and write of a workspace's repositories starts from,
 * shared by the pull request and issue access: the installation, checked
 * usable in the caller's scope; the repository, checked covered by it; the
 * installation's token to read with; and the caller's own token to write
 * with. The installation tokens are kept in this process only, for most of
 * their hour, and never written anywhere: one holder, so a token minted for
 * one area serves the other.
 */
@Injectable()
export class GithubAccessResolver {
  private readonly installationTokens = new Map<number, { token: string; expiresAt: number }>();

  constructor(
    @Inject(GITHUB_INSTALLATION_REPOSITORY)
    private readonly installations: GithubInstallationRepositoryPort,
    @Inject(GITHUB_APP)
    private readonly github: GithubAppPort,
    private readonly userGrants: GithubUserGrantResolver,
    private readonly cache: CacheService,
    private readonly tokens: GithubTokenResolver,
  ) {}

  /**
   * The repository an address names, checked reachable: covered by the
   * installation it names, or, for an address with no installation, opened by
   * one of the caller's own tokens (§6.2).
   */
  async repositoryOf(scope: AccessScope, address: RepositoryAddress): Promise<WorkspaceRepository> {
    if (address.installationId === null) return this.tokenRepositoryOf(scope, address.githubRepoId);
    const installation = await this.usableInstallation(scope, address.installationId);
    const repositories = await this.cache.getOrSet(
      `github:repositories:${installation.id}`,
      REPOSITORIES_TTL_SECONDS,
      () => this.github.listInstallationRepositories(installation.githubInstallationId),
    );
    const repository = repositories.find(
      (candidate) => candidate.githubRepoId === address.githubRepoId,
    );
    if (!repository) {
      throw new AppError(GithubErrors.REPOSITORY_NOT_IN_INSTALLATION, {
        detail: `Repository ${address.githubRepoId} is not covered by this installation`,
      });
    }
    return {
      installationId: installation.id,
      githubRepoId: repository.githubRepoId,
      name: repository.name,
      fullName: repository.fullName,
      defaultBranch: repository.defaultBranch,
      private: repository.private,
    };
  }

  /**
   * The installation's token, held for most of its hour, and the budget GitHub
   * counts it against: the installation, whichever token was minted for it.
   */
  async readCredential(scope: AccessScope, address: RepositoryAddress): Promise<GithubCredential> {
    if (address.installationId === null) {
      return this.tokens.credentialFor(scope.userId, address.githubRepoId, new Date());
    }
    const installation = await this.usableInstallation(scope, address.installationId);
    const githubInstallationId = installation.githubInstallationId;
    const bucket = `installation:${githubInstallationId}` as const;
    const held = this.installationTokens.get(githubInstallationId);
    if (held && held.expiresAt - Date.now() > TOKEN_MARGIN_MS) return { token: held.token, bucket };
    const minted = await this.github.mintInstallationToken(githubInstallationId);
    this.installationTokens.set(githubInstallationId, {
      token: minted.token,
      expiresAt: minted.expiresAt.getTime(),
    });
    return { token: minted.token, bucket };
  }

  /**
   * The caller's own GitHub token, counted against them (every token of
   * theirs shares one budget): every write is made in their name, never
   * anyone else's.
   */
  async writeCredential(userId: string, repository: RepositoryAddress): Promise<GithubCredential> {
    if (repository.installationId === null) {
      throw new AppError(GithubErrors.READ_ONLY_REPOSITORY, {
        detail: `Repository ${repository.githubRepoId} is read through your own GitHub token.`,
      });
    }
    const actor = await this.userGrants.actorFor(userId);
    if (!actor) {
      throw new AppError(GithubErrors.USER_NOT_CONNECTED, {
        detail: 'Connect GitHub from Settings so reviews, merges and issues are made in your name.',
      });
    }
    return { token: actor.token, bucket: `user:${actor.githubUserId}` };
  }

  /**
   * Every repository the caller's own tokens open, archived ones aside, as
   * addresses with no installation. Empty when tokens are not configured here.
   */
  async tokenRepositories(scope: AccessScope): Promise<WorkspaceRepository[]> {
    if (!this.tokens.isConfigured()) return [];
    return (await this.tokens.repositoriesOf(scope.userId, new Date())).map((repository) => ({
      installationId: null,
      githubRepoId: repository.githubRepoId,
      name: repository.name,
      fullName: repository.fullName,
      defaultBranch: repository.defaultBranch,
      private: repository.private,
    }));
  }

  /** The login a token of the caller's belongs to, oldest token first; null when they have none. */
  async tokenLogin(scope: AccessScope): Promise<string | null> {
    return (await this.tokens.findOwn(scope.userId))[0]?.login ?? null;
  }

  private async tokenRepositoryOf(
    scope: AccessScope,
    githubRepoId: number,
  ): Promise<WorkspaceRepository> {
    const repository = (await this.tokenRepositories(scope)).find(
      (candidate) => candidate.githubRepoId === githubRepoId,
    );
    if (!repository) {
      throw new AppError(GithubErrors.NO_TOKEN_FOR_REPOSITORY, {
        detail: `None of your GitHub tokens opens repository ${githubRepoId}`,
      });
    }
    return repository;
  }

  async usableInstallation(
    scope: AccessScope,
    installationId: string,
  ): Promise<GithubInstallationEntity> {
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
    return installation;
  }
}
