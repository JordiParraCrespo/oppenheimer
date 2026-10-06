import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import type { GithubInstallationRepositoryPort } from '../database/github-installation.repository.port';
import { planClosedReads } from '../domain/closed-read.policy';
import { GithubErrors } from '../domain/github.errors';
import type { GithubInstallationEntity } from '../domain/github-installation.entity';
import { GITHUB_APP, GITHUB_INSTALLATION_REPOSITORY, GITHUB_PULLS } from '../github.di-tokens';
import type { GithubAppPort } from '../infrastructure/github-app.port';
import type {
  GithubPullRequestDetail,
  GithubPullRequestFile,
  GithubPullRequestSummary,
  GithubPullsPort,
  GithubRefusal,
  GithubReviewComment,
} from '../infrastructure/github-pulls.port';
import { type GithubActor, GithubUserGrantResolver } from './github-user-grant.resolver';
import type {
  Part,
  PullRequestAccessPort,
  PullRequestAddress,
  PullRequestSnapshot,
  ReadGap,
  RepositoryPulls,
  ReviewSubmission,
  WorkspaceRepository,
} from './pull-request-access.port';

/** A repository's open list: short, so a merge or a new push shows on the next look. */
const OPEN_TTL_SECONDS = 30;
/** A closed pull request no longer changes: its snapshot is kept for most of a day. */
const CLOSED_SNAPSHOT_TTL_SECONDS = 6 * 3600;
/** A snapshot GitHub answered only in part is kept briefly, so the next read asks again (#244). */
const PARTIAL_TTL_SECONDS = 15;
const REPOSITORIES_TTL_SECONDS = 60;
/** An installation token is reused until this close to GitHub's one-hour expiry. */
const TOKEN_MARGIN_MS = 5 * 60_000;
/** GitHub's page: Analytics lists one per repository, the newest closed. */
const PULLS_PER_PAGE = 100;

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
  ): Promise<RepositoryPulls> {
    const listing = await this.list(scope, repository, 'open', OPEN_TTL_SECONDS);
    if (!listing.ok)
      return {
        repository,
        snapshots: [],
        gaps: [{ what: 'repository', refusal: listing.refusal }],
      };
    return this.snapshotsOf(listing.token, repository, listing.pulls, OPEN_TTL_SECONDS);
  }

  async closedPullRequests(
    scope: AccessScope,
    repositories: WorkspaceRepository[],
    since: Date,
    limit: number,
  ): Promise<{ pulls: RepositoryPulls[]; complete: boolean }> {
    const listings = await Promise.all(
      repositories.map((repository) =>
        this.list(scope, repository, 'closed', OPEN_TTL_SECONDS * 4),
      ),
    );
    const plan = planClosedReads(
      listings.map((listing) =>
        listing.ok
          ? { pulls: listing.pulls, full: listing.pulls.length >= PULLS_PER_PAGE }
          : { pulls: [], full: false },
      ),
      (pull) => pull.closedAt ?? pull.updatedAt,
      since,
      limit,
    );
    const pulls = await Promise.all(
      listings.map((listing, index) => {
        const repository = repositories[index] as WorkspaceRepository;
        return listing.ok
          ? this.snapshotsOf(
              listing.token,
              repository,
              plan.picks[index] ?? [],
              CLOSED_SNAPSHOT_TTL_SECONDS,
            )
          : {
              repository,
              snapshots: [],
              gaps: [{ what: 'repository' as const, refusal: listing.refusal }],
            };
      }),
    );
    return { pulls, complete: plan.complete };
  }

  /** One repository's newest page of pull requests in a state, or the refusal GitHub gave. */
  private async list(
    scope: AccessScope,
    repository: WorkspaceRepository,
    state: 'open' | 'closed',
    ttlSeconds: number,
  ): Promise<
    | { ok: true; token: string; pulls: GithubPullRequestSummary[] }
    | { ok: false; refusal: GithubRefusal }
  > {
    try {
      const token = await this.readToken(scope, repository.installationId);
      const pulls = await this.cache.getOrSet(
        `github:pulls:${state}:${repository.installationId}:${repository.githubRepoId}`,
        ttlSeconds,
        () => this.pulls.listPullRequests(token, repository.fullName, state, 1),
      );
      return { ok: true, token, pulls };
    } catch (error) {
      return { ok: false, refusal: refusalOf(error) };
    }
  }

  async pullRequest(scope: AccessScope, address: PullRequestAddress): Promise<PullRequestSnapshot> {
    const repository = await this.repositoryOf(scope, address);
    const token = await this.readToken(scope, address.installationId);
    // Read live once to learn `updated_at`, so the snapshot key changes the moment GitHub's answer does.
    const pull = await this.pulls.readPullRequest(token, repository.fullName, address.number);
    return this.snapshot(token, repository, pull.number, pull.updatedAt, OPEN_TTL_SECONDS, pull);
  }

  async files(scope: AccessScope, address: PullRequestAddress): Promise<GithubPullRequestFile[]> {
    const repository = await this.repositoryOf(scope, address);
    const token = await this.readToken(scope, address.installationId);
    return this.pulls.listFiles(token, repository.fullName, address.number);
  }

  async reviewComments(
    scope: AccessScope,
    address: PullRequestAddress,
  ): Promise<GithubReviewComment[]> {
    const repository = await this.repositoryOf(scope, address);
    const token = await this.readToken(scope, address.installationId);
    return this.pulls.listReviewComments(token, repository.fullName, address.number);
  }

  async submitReview(
    scope: AccessScope,
    userId: string,
    address: PullRequestAddress,
    review: ReviewSubmission,
  ): Promise<void> {
    const { repository, actor, head } = await this.forWrite(scope, userId, address);
    await this.pulls.createReview(actor.token, repository.fullName, address.number, {
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
    await this.pulls.createReviewComment(actor.token, repository.fullName, address.number, {
      ...comment,
      commitId: head,
    });
  }

  async merge(
    scope: AccessScope,
    userId: string,
    address: PullRequestAddress,
    method: 'squash' | 'merge' | 'rebase',
  ): Promise<void> {
    const { repository, actor, head } = await this.forWrite(scope, userId, address);
    await this.pulls.merge(actor.token, repository.fullName, address.number, method, head);
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
    const token = await this.readToken(scope, address.installationId);
    const pull = await this.pulls.readPullRequest(token, repository.fullName, address.number);
    return { repository, actor, head: pull.headSha };
  }

  private async forget(repository: WorkspaceRepository): Promise<void> {
    await this.cache.del(
      `github:pulls:open:${repository.installationId}:${repository.githubRepoId}`,
    );
  }

  /** Each pull request's snapshot, and every gap with the refusal GitHub gave for it. */
  private async snapshotsOf(
    token: string,
    repository: WorkspaceRepository,
    pulls: GithubPullRequestSummary[],
    ttlSeconds: number,
  ): Promise<RepositoryPulls> {
    const settled = await Promise.allSettled(
      pulls.map((pull) =>
        this.snapshot(token, repository, pull.number, pull.updatedAt, ttlSeconds),
      ),
    );
    const snapshots = settled.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    const gaps: ReadGap[] = settled.flatMap((result) =>
      result.status === 'rejected'
        ? [{ what: 'pull_requests' as const, refusal: refusalOf(result.reason) }]
        : [],
    );
    for (const snapshot of snapshots) {
      if (snapshot.files.refusal) gaps.push({ what: 'files', refusal: snapshot.files.refusal });
      if (snapshot.checks.refusal) gaps.push({ what: 'checks', refusal: snapshot.checks.refusal });
      if (snapshot.reviews.refusal)
        gaps.push({ what: 'reviews', refusal: snapshot.reviews.refusal });
    }
    return { repository, snapshots, gaps };
  }

  /**
   * The pull request and its three parts. The pull request itself must be
   * read; files, checks and reviews each settle on their own, and a snapshot
   * with a refused part is cached only briefly so the next read asks again.
   */
  private async snapshot(
    token: string,
    repository: WorkspaceRepository,
    number: number,
    updatedAt: string,
    ttlSeconds: number,
    known?: GithubPullRequestDetail,
  ): Promise<PullRequestSnapshot> {
    const key = `github:pulls:snapshot:${repository.installationId}:${repository.githubRepoId}:${number}:${updatedAt}`;
    const cached = await this.cache.get<PullRequestSnapshot>(key);
    if (cached) return cached;

    const pull = known ?? (await this.pulls.readPullRequest(token, repository.fullName, number));
    const [files, checks, reviews] = await Promise.all([
      partOf(
        this.pulls
          .listFiles(token, repository.fullName, number)
          .then((list) => list.map((file) => file.path)),
      ),
      partOf(this.pulls.readChecks(token, repository.fullName, pull.headSha)),
      partOf(this.pulls.listReviews(token, repository.fullName, number)),
    ]);
    const snapshot: PullRequestSnapshot = { repository, pull, files, checks, reviews };
    const whole = !files.refusal && !checks.refusal && !reviews.refusal;
    await this.cache.set(key, snapshot, whole ? ttlSeconds : PARTIAL_TTL_SECONDS);
    return snapshot;
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

  private async readToken(scope: AccessScope, installationId: string): Promise<string> {
    const installation = await this.usableInstallation(scope, installationId);
    const held = this.installationTokens.get(installation.githubInstallationId);
    if (held && held.expiresAt - Date.now() > TOKEN_MARGIN_MS) return held.token;
    const minted = await this.github.mintInstallationToken(installation.githubInstallationId);
    this.installationTokens.set(installation.githubInstallationId, {
      token: minted.token,
      expiresAt: minted.expiresAt.getTime(),
    });
    return minted.token;
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

async function partOf<T>(read: Promise<T>): Promise<Part<T>> {
  try {
    return { value: await read, refusal: null };
  } catch (error) {
    return { value: null, refusal: refusalOf(error) };
  }
}

/** What a failed read means to a reader: no access, gone, wait, or GitHub did not answer. */
function refusalOf(error: unknown): GithubRefusal {
  if (!(error instanceof AppError)) return 'failed';
  if (error.code === GithubErrors.RATE_LIMITED.code) return 'rate_limited';
  if (
    error.code === GithubErrors.INSTALLATION_SUSPENDED.code ||
    error.code === GithubErrors.INSTALLATION_NOT_FOUND.code
  ) {
    return 'forbidden';
  }
  const status = error.extensions.upstreamStatus;
  if (status === 401 || status === 403) return 'forbidden';
  if (status === 404 || error.code === GithubErrors.PULL_REQUEST_NOT_FOUND.code) return 'not_found';
  return 'failed';
}
