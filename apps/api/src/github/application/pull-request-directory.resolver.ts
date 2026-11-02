import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { CacheService } from '@oppenheimer/backend-cache';
import type { GithubInstallationRepositoryPort } from '../database/github-installation.repository.port';
import { GITHUB_APP, GITHUB_INSTALLATION_REPOSITORY } from '../github.di-tokens';
import type { GithubAppPort } from '../infrastructure/github-app.port';
import { GithubAccessResolver } from './github-access.resolver';
import { GithubUserGrantResolver } from './github-user-grant.resolver';
import type { WorkspaceRepository } from './pull-request-access.port';
import type { PullRequestDirectoryPort } from './pull-request-directory.port';

const REPOSITORIES_TTL_SECONDS = 60;

/**
 * The workspace's repositories, each installation's list cached briefly in
 * Redis as GitHub's own answer, and who the caller is on GitHub.
 */
@Injectable()
export class PullRequestDirectoryResolver implements PullRequestDirectoryPort {
  constructor(
    @Inject(GITHUB_INSTALLATION_REPOSITORY)
    private readonly installations: GithubInstallationRepositoryPort,
    @Inject(GITHUB_APP)
    private readonly github: GithubAppPort,
    private readonly userGrants: GithubUserGrantResolver,
    private readonly cache: CacheService,
    private readonly access: GithubAccessResolver,
  ) {}

  /**
   * Every repository the workspace's usable installations cover, then the ones
   * only the caller's own tokens open (§6.2): the App reads a repository it
   * covers, so a token's copy of it is left out.
   */
  async repositories(scope: AccessScope): Promise<WorkspaceRepository[]> {
    const [installed, tokens] = await Promise.all([
      this.installedRepositories(scope),
      this.access.tokenRepositories(scope),
    ]);
    const covered = new Set(installed.map((repository) => repository.githubRepoId));
    return [...installed, ...tokens.filter((repository) => !covered.has(repository.githubRepoId))];
  }

  private async installedRepositories(scope: AccessScope): Promise<WorkspaceRepository[]> {
    const installations = (await this.installations.findAll(scope)).filter((i) => i.isUsable);
    const lists = await Promise.all(
      installations.map(async (installation) => {
        const repositories = await this.cache.getOrSet(
          `github:repositories:${installation.id}`,
          REPOSITORIES_TTL_SECONDS,
          () => this.github.listInstallationRepositories(installation.githubInstallationId),
        );
        return repositories
          .filter((repository) => !repository.archived)
          .map((repository) => ({
            kind: 'installation' as const,
            installationId: installation.id,
            githubRepoId: repository.githubRepoId,
            name: repository.name,
            fullName: repository.fullName,
            defaultBranch: repository.defaultBranch,
            private: repository.private,
          }));
      }),
    );
    return lists.flat();
  }

  /**
   * Who the reader is on GitHub, which is what sorts a pull request into
   * theirs, asked of them, or merely watched.
   *
   * Their stored grant answers it when they have connected GitHub through the
   * console. Without one — an installation connected before the console kept a
   * user token, or an account that signs in with another provider — a
   * **personal** installation still answers it: GitHub lets nobody but the
   * account itself install an App on a user account, so the account this
   * person connected is this person. An organization's installation says
   * nothing of the kind, and is not read as identity.
   */
  async viewerLogin(scope: AccessScope): Promise<string | null> {
    const granted = await this.userGrants.loginOf(scope.userId);
    if (granted) return granted;
    const installations = await this.installations.findAll(scope);
    const personal = installations.find(
      (installation) =>
        installation.accountType === 'User' && installation.installedByUserId === scope.userId,
    )?.accountLogin;
    // A token says whose it is just as surely: GitHub answered `GET /user` with it.
    return personal ?? (await this.access.tokenLogin(scope));
  }
}
