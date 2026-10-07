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
  GithubCredential,
  GithubPullRequestDetail,
  GithubPullRequestFile,
  GithubPullRequestSummary,
  GithubPullsPort,
  GithubRefusal,
  GithubReviewComment,
} from '../infrastructure/github-pulls.port';
import { type GithubActor, GithubUserGrantResolver } from './github-user-grant.resolver';
import {
  type Part,
  type PullRequestAccessPort,
  type PullRequestAddress,
  type PullRequestSnapshot,
  type ReadBudget,
  type ReadGap,
  type RepositoryPulls,
  type ReviewSubmission,
  UNASKED,
  type WorkspaceRepository,
} from './pull-request-access.port';

/** A repository's open list: short, so a merge or a new push shows on the next look. */
const OPEN_TTL_SECONDS = 30;
/** A closed pull request no longer changes: its snapshot is kept for most of a day. */
const CLOSED_SNAPSHOT_TTL_SECONDS = 6 * 3600;
/** A snapshot GitHub answered only in part is kept briefly, so the next read asks again (#244). */
const PARTIAL_TTL_SECONDS = 15;
/**
 * A part GitHub refused with "slow down" is kept far longer than one it simply
 * failed (#247). A secondary rate limit lasts minutes, so asking again fifteen
 * seconds later earns another refusal and nothing else: the gap caches itself
 * out of existence and re-creates itself on every view.
 */
const RATE_LIMITED_TTL_SECONDS = 5 * 60;
/**
 * How many pull requests one read fills the parts of. The rest come back from
 * their listing alone — a row, its times and whose it is — and the next read
 * fills more, because a filled snapshot is cached and costs nothing to keep.
 *
 * Small on purpose. Each filled pull request is three or four requests that
 * GitHub's own pace spreads over a second or so, and they are what a reader
 * waits for: at twelve, a queue of thirteen took eleven seconds to answer
 * rows it already had. At five it answers in about two and is whole within a
 * few polls, which is the trade the reader wants (#247).
 */
const SNAPSHOT_BUDGET = 5;
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
    return (
      installations.find(
        (installation) =>
          installation.accountType === 'User' && installation.installedByUserId === scope.userId,
      )?.accountLogin ?? null
    );
  }

  /** One page view's budget, opened by the handler and passed to every read it makes. */
  readBudget(): ReadBudget {
    return { left: SNAPSHOT_BUDGET };
  }

  async openPullRequests(
    scope: AccessScope,
    repository: WorkspaceRepository,
    budget: ReadBudget = this.readBudget(),
  ): Promise<RepositoryPulls> {
    const listing = await this.list(scope, repository, 'open', OPEN_TTL_SECONDS);
    if (!listing.ok)
      return {
        repository,
        snapshots: [],
        gaps: [{ what: 'repository', refusal: listing.refusal }],
      };
    return this.snapshotsOf(listing.credential, repository, listing.pulls, OPEN_TTL_SECONDS, {
      budget,
    });
  }

  async closedPullRequests(
    scope: AccessScope,
    repositories: WorkspaceRepository[],
    since: Date,
    limit: number,
    budget: ReadBudget = this.readBudget(),
  ): Promise<{
    pulls: RepositoryPulls[];
    counted: GithubPullRequestSummary[];
    complete: boolean;
  }> {
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
              listing.credential,
              repository,
              plan.picks[index] ?? [],
              CLOSED_SNAPSHOT_TTL_SECONDS,
              // A closed pull request's checks are read by nothing — the
              // analytics' blockers are the open ones' — and cost two requests
              // each.
              { budget, checks: false, skipUnbudgeted: true },
            )
          : {
              repository,
              snapshots: [],
              gaps: [{ what: 'repository' as const, refusal: listing.refusal }],
            };
      }),
    );
    // Every pull request the window holds, as its listing gave it. What a
    // figure counts and what the day chart draws are read from these, so a
    // pull request whose parts this view had no budget to fill is still
    // counted — the numbers are whole from the first read, and only the
    // medians and the lane mix deepen as later reads fill more (#247).
    const counted = plan.picks.flat();
    return { pulls, counted, complete: plan.complete };
  }

  /** One repository's newest page of pull requests in a state, or the refusal GitHub gave. */
  private async list(
    scope: AccessScope,
    repository: WorkspaceRepository,
    state: 'open' | 'closed',
    ttlSeconds: number,
  ): Promise<
    | { ok: true; credential: GithubCredential; pulls: GithubPullRequestSummary[] }
    | { ok: false; refusal: GithubRefusal }
  > {
    try {
      const credential = await this.readCredential(scope, repository.installationId);
      const pulls = await this.cache.getOrSet(
        `github:pulls:${state}:${repository.installationId}:${repository.githubRepoId}`,
        ttlSeconds,
        () => this.pulls.listPullRequests(credential, repository.fullName, state, 1),
      );
      return { ok: true, credential, pulls };
    } catch (error) {
      return { ok: false, refusal: refusalOf(error) };
    }
  }

  async pullRequest(scope: AccessScope, address: PullRequestAddress): Promise<PullRequestSnapshot> {
    const repository = await this.repositoryOf(scope, address);
    const credential = await this.readCredential(scope, address.installationId);
    // Read live once to learn `updated_at`, so the snapshot key changes the moment GitHub's answer does.
    const pull = await this.pulls.readPullRequest(credential, repository.fullName, address.number);
    // No budget is passed, so this never answers null: one pull request on its
    // own screen is read whole.
    return (await this.snapshot(
      credential,
      repository,
      pull.number,
      pull.updatedAt,
      OPEN_TTL_SECONDS,
      // One pull request on its own screen: no budget, it is what the reader asked for.
      { known: pull },
    )) as PullRequestSnapshot;
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

  /**
   * Each pull request's snapshot, and every gap with the refusal GitHub gave
   * for it.
   *
   * What the budget buys is the *parts*. One already in the cache costs
   * nothing and is never counted; past the budget a pull request is read on
   * its own — one request, so it has its row, its times and its size — and its
   * parts are left unasked for the next read to fill (#247).
   */
  private async snapshotsOf(
    credential: GithubCredential,
    repository: WorkspaceRepository,
    pulls: GithubPullRequestSummary[],
    ttlSeconds: number,
    options: { budget: ReadBudget; checks?: boolean; skipUnbudgeted?: boolean },
  ): Promise<RepositoryPulls> {
    const settled = await Promise.allSettled(
      pulls.map((pull) =>
        this.snapshot(credential, repository, pull.number, pull.updatedAt, ttlSeconds, {
          budget: options.budget,
          checks: options.checks,
          skipUnbudgeted: options.skipUnbudgeted,
        }),
      ),
    );
    const snapshots = settled.flatMap((result) =>
      result.status === 'fulfilled' && result.value !== null ? [result.value] : [],
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
   * with a refused part is cached only briefly so the next read asks again —
   * except one refused with "slow down", which is kept until the limit has
   * had time to lift.
   *
   * `budget` decides whether the parts are asked for at all; `checks: false`
   * leaves out the pair of requests a caller will not read.
   */
  private async snapshot(
    credential: GithubCredential,
    repository: WorkspaceRepository,
    number: number,
    updatedAt: string,
    ttlSeconds: number,
    options: {
      known?: GithubPullRequestDetail;
      budget?: ReadBudget;
      checks?: boolean;
      /** Past the budget, answer with nothing at all rather than the pull request alone. */
      skipUnbudgeted?: boolean;
    } = {},
  ): Promise<PullRequestSnapshot | null> {
    const key = `github:pulls:snapshot:${repository.installationId}:${repository.githubRepoId}:${number}:${updatedAt}`;
    const cached = await this.cache.get<PullRequestSnapshot>(key);
    if (cached) return cached;

    // Spent before the pull request itself, when the caller can do without it:
    // a closed one past the budget is counted from its listing, so reading it
    // is a request that buys nothing this view will show (#247).
    if (options.budget && !spend(options.budget)) {
      if (options.skipUnbudgeted) return null;
      const pull =
        options.known ??
        (await this.pulls.readPullRequest(credential, repository.fullName, number));
      return { repository, pull, files: UNASKED, checks: UNASKED, reviews: UNASKED };
    }
    const pull =
      options.known ?? (await this.pulls.readPullRequest(credential, repository.fullName, number));
    const [files, checks, reviews] = await Promise.all([
      partOf(
        this.pulls
          .listFiles(credential, repository.fullName, number)
          .then((list) => list.map((file) => file.path)),
      ),
      options.checks === false
        ? Promise.resolve(UNASKED)
        : partOf(this.pulls.readChecks(credential, repository.fullName, pull.headSha)),
      partOf(this.pulls.listReviews(credential, repository.fullName, number)),
    ]);
    const snapshot: PullRequestSnapshot = { repository, pull, files, checks, reviews };
    const refusals = [files.refusal, checks.refusal, reviews.refusal];
    const ttl = refusals.includes('rate_limited')
      ? RATE_LIMITED_TTL_SECONDS
      : refusals.some(Boolean)
        ? PARTIAL_TTL_SECONDS
        : ttlSeconds;
    await this.cache.set(key, snapshot, ttl);
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

/** True while there is budget left, and takes one. */
function spend(budget: ReadBudget): boolean {
  if (budget.left <= 0) return false;
  budget.left -= 1;
  return true;
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

/** A person's own token, counted against them: every token of theirs shares one budget. */
function actorCredential(actor: GithubActor): GithubCredential {
  return { token: actor.token, bucket: `user:${actor.githubUserId}` };
}
