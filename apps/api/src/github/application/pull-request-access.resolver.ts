import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import type { GithubInstallationRepositoryPort } from '../database/github-installation.repository.port';
import { GithubErrors } from '../domain/github.errors';
import type { GithubInstallationEntity } from '../domain/github-installation.entity';
import { GITHUB_APP, GITHUB_INSTALLATION_REPOSITORY, GITHUB_PULLS } from '../github.di-tokens';
import type { GithubAppPort } from '../infrastructure/github-app.port';
import type {
  GithubCredential,
  GithubPullRequestDetail,
  GithubPullRequestFile,
  GithubPullsPort,
  GithubReviewComment,
} from '../infrastructure/github-pulls.port';
import { type GithubActor, GithubUserGrantResolver } from './github-user-grant.resolver';
import type {
  PullRequestAccessPort,
  PullRequestAddress,
  PullRequestSnapshot,
  ReviewSubmission,
  WorkspaceRepository,
} from './pull-request-access.port';

/** A repository's open list: short, so a merge or a new push shows on the next look. */
const OPEN_TTL_SECONDS = 30;
/** A snapshot is keyed by the PR's `updated_at`, so it can live until GitHub says it changed. */
const SNAPSHOT_TTL_SECONDS = 600;
const REPOSITORIES_TTL_SECONDS = 60;
/** An installation token is reused until this close to GitHub's one-hour expiry. */
const TOKEN_MARGIN_MS = 5 * 60_000;
/** The analytics read at most this many closed pull requests per repository. */
const CLOSED_PAGES = 2;

/**
 * Reads through the installation, cached briefly in Redis as GitHub's own
 * answers (`CacheService`, JSON) and never as a mirror; writes through the
 * caller's own user token. The installation tokens reads use are kept in this
 * process only, for most of their hour, and never written anywhere.
 */
@Injectable()
export class PullRequestAccessResolver implements PullRequestAccessPort {
  private readonly installationTokens = new Map<number, { token: string; expiresAt: number }>();

  constructor(
    @Inject(GITHUB_INSTALLATION_REPOSITORY)
    private readonly installations: GithubInstallationRepositoryPort,
    @Inject(GITHUB_APP)
    private readonly github: GithubAppPort,
    @Inject(GITHUB_PULLS)
    private readonly pulls: GithubPullsPort,
    private readonly userGrants: GithubUserGrantResolver,
    private readonly cache: CacheService,
  ) {}

  async repositories(scope: AccessScope): Promise<WorkspaceRepository[]> {
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

  viewerLogin(userId: string): Promise<string | null> {
    return this.userGrants.loginOf(userId);
  }

  async openPullRequests(
    scope: AccessScope,
    repository: WorkspaceRepository,
  ): Promise<PullRequestSnapshot[]> {
    const credential = await this.readCredential(scope, repository.installationId);
    const open = await this.cache.getOrSet(
      `github:pulls:open:${repository.installationId}:${repository.githubRepoId}`,
      OPEN_TTL_SECONDS,
      () => this.pulls.listPullRequests(credential, repository.fullName, 'open', 1),
    );
    return Promise.all(
      open.map((pull) =>
        this.snapshot(credential, repository, pull.number, pull.updatedAt, OPEN_TTL_SECONDS),
      ),
    );
  }

  async closedPullRequests(
    scope: AccessScope,
    repository: WorkspaceRepository,
    since: Date,
  ): Promise<PullRequestSnapshot[]> {
    const credential = await this.readCredential(scope, repository.installationId);
    const closed = await this.cache.getOrSet(
      `github:pulls:closed:${repository.installationId}:${repository.githubRepoId}`,
      OPEN_TTL_SECONDS * 4,
      () => this.pulls.listPullRequests(credential, repository.fullName, 'closed', CLOSED_PAGES),
    );
    const recent = closed.filter((pull) => new Date(pull.closedAt ?? pull.updatedAt) >= since);
    return Promise.all(
      recent.map((pull) =>
        this.snapshot(credential, repository, pull.number, pull.updatedAt, SNAPSHOT_TTL_SECONDS),
      ),
    );
  }

  async pullRequest(scope: AccessScope, address: PullRequestAddress): Promise<PullRequestSnapshot> {
    const repository = await this.repositoryOf(scope, address);
    const credential = await this.readCredential(scope, address.installationId);
    // Read live once to learn `updated_at`, so the snapshot key changes the moment GitHub's answer does.
    const pull = await this.pulls.readPullRequest(credential, repository.fullName, address.number);
    return this.snapshot(
      credential,
      repository,
      pull.number,
      pull.updatedAt,
      OPEN_TTL_SECONDS,
      pull,
    );
  }

  async files(scope: AccessScope, address: PullRequestAddress): Promise<GithubPullRequestFile[]> {
    const repository = await this.repositoryOf(scope, address);
    const credential = await this.readCredential(scope, address.installationId);
    return this.pulls.listFiles(credential, repository.fullName, address.number);
  }

  async reviewComments(
    scope: AccessScope,
    address: PullRequestAddress,
  ): Promise<GithubReviewComment[]> {
    const repository = await this.repositoryOf(scope, address);
    const credential = await this.readCredential(scope, address.installationId);
    return this.pulls.listReviewComments(credential, repository.fullName, address.number);
  }

  async submitReview(
    scope: AccessScope,
    userId: string,
    address: PullRequestAddress,
    review: ReviewSubmission,
  ): Promise<void> {
    const { repository, actor, head } = await this.forWrite(scope, userId, address);
    await this.pulls.createReview(actorCredential(actor), repository.fullName, address.number, {
      ...review,
      commitId: head,
    });
    await this.forget(repository);
  }

  async addComment(
    scope: AccessScope,
    userId: string,
    address: PullRequestAddress,
    comment: { path: string; line: number; side: 'LEFT' | 'RIGHT'; body: string },
  ): Promise<void> {
    const { repository, actor, head } = await this.forWrite(scope, userId, address);
    await this.pulls.createReviewComment(
      actorCredential(actor),
      repository.fullName,
      address.number,
      {
        ...comment,
        commitId: head,
      },
    );
  }

  async merge(
    scope: AccessScope,
    userId: string,
    address: PullRequestAddress,
    method: 'squash' | 'merge' | 'rebase',
  ): Promise<void> {
    const { repository, actor, head } = await this.forWrite(scope, userId, address);
    await this.pulls.merge(
      actorCredential(actor),
      repository.fullName,
      address.number,
      method,
      head,
    );
    await this.forget(repository);
  }

  /** The repository, the caller's own token and the head commit a write lands on. */
  private async forWrite(scope: AccessScope, userId: string, address: PullRequestAddress) {
    const repository = await this.repositoryOf(scope, address);
    const actor: GithubActor | null = await this.userGrants.actorFor(userId);
    if (!actor) {
      throw new AppError(GithubErrors.USER_NOT_CONNECTED, {
        detail: 'Connect GitHub from Settings so reviews and merges are made in your name.',
      });
    }
    const credential = await this.readCredential(scope, address.installationId);
    const pull = await this.pulls.readPullRequest(credential, repository.fullName, address.number);
    return { repository, actor, head: pull.headSha };
  }

  private async forget(repository: WorkspaceRepository): Promise<void> {
    await this.cache.del(
      `github:pulls:open:${repository.installationId}:${repository.githubRepoId}`,
    );
  }

  private async snapshot(
    credential: GithubCredential,
    repository: WorkspaceRepository,
    number: number,
    updatedAt: string,
    ttlSeconds: number,
    known?: GithubPullRequestDetail,
  ): Promise<PullRequestSnapshot> {
    const key = `github:pulls:snapshot:${repository.installationId}:${repository.githubRepoId}:${number}:${updatedAt}`;
    const read = async (): Promise<PullRequestSnapshot> => {
      const pull =
        known ?? (await this.pulls.readPullRequest(credential, repository.fullName, number));
      const [files, checks, reviews] = await Promise.all([
        this.pulls.listFiles(credential, repository.fullName, number),
        this.pulls.readChecks(credential, repository.fullName, pull.headSha),
        this.pulls.listReviews(credential, repository.fullName, number),
      ]);
      return { repository, pull, filePaths: files.map((file) => file.path), checks, reviews };
    };
    // Checks move without `updated_at` moving, so an open PR's snapshot is short-lived.
    return this.cache.getOrSet(key, ttlSeconds, read);
  }

  private async repositoryOf(
    scope: AccessScope,
    address: PullRequestAddress,
  ): Promise<WorkspaceRepository> {
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
  private async readCredential(
    scope: AccessScope,
    installationId: string,
  ): Promise<GithubCredential> {
    const installation = await this.usableInstallation(scope, installationId);
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

  private async usableInstallation(
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

/** A person's own token, counted against them: every token of theirs shares one budget. */
function actorCredential(actor: GithubActor): GithubCredential {
  return { token: actor.token, bucket: `user:${actor.githubUserId}` };
}
