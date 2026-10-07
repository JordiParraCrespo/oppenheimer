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
  GithubChecks,
  GithubCredential,
  GithubPullRequestDetail,
  GithubPullRequestFile,
  GithubPullRequestSummary,
  GithubPullsPort,
  GithubRefusal,
  GithubReviewComment,
  GithubTimelineItem,
} from '../infrastructure/github-pulls.port';
import { type GithubActor, GithubUserGrantResolver } from './github-user-grant.resolver';
import {
  type ClosedPullRequestSnapshot,
  type Part,
  type PullRequestAccessPort,
  type PullRequestAddress,
  type PullRequestRead,
  type PullRequestSnapshot,
  type ReadBudget,
  type ReadGap,
  type RepositoryPulls,
  type ReviewSubmission,
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
  /** One fill per snapshot key at a time; see {@link once}. */
  private readonly inFlight = new Map<string, Promise<unknown>>();

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

  /**
   * One budget, opened by the handler and passed to every read it makes. The
   * handler opens one per half of a view that reads two ways round (the
   * figures' open and closed halves), so neither can take the other's slots.
   */
  readBudget(): ReadBudget {
    let left = SNAPSHOT_BUDGET;
    return {
      reserve(wanted: number): number {
        const granted = Math.max(0, Math.min(wanted, left));
        left -= granted;
        return granted;
      },
    };
  }

  async openPullRequests(
    scope: AccessScope,
    repository: WorkspaceRepository,
    budget: ReadBudget,
  ): Promise<RepositoryPulls<PullRequestSnapshot>> {
    const listing = await this.list(scope, repository, 'open', OPEN_TTL_SECONDS);
    if (!listing.ok)
      return {
        repository,
        snapshots: [],
        deferred: 0,
        gaps: [{ what: 'repository', refusal: listing.refusal }],
      };
    return this.snapshotsOf(
      listing.credential,
      repository,
      listing.pulls,
      OPEN_TTL_SECONDS,
      budget,
    );
  }

  async closedPullRequests(
    scope: AccessScope,
    repositories: WorkspaceRepository[],
    since: Date,
    limit: number,
    budget: ReadBudget,
  ): Promise<{
    pulls: RepositoryPulls<ClosedPullRequestSnapshot>[];
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
          ? this.closedSnapshotsOf(
              listing.credential,
              repository,
              plan.picks[index] ?? [],
              CLOSED_SNAPSHOT_TTL_SECONDS,
              budget,
            )
          : {
              repository,
              snapshots: [],
              deferred: 0,
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
    const key = snapshotKey(repository, pull.number, pull.updatedAt, true);
    // One pull request on its own screen draws on no budget: it is the whole
    // of what the reader asked for.
    return (
      (await this.cache.get<PullRequestSnapshot>(key)) ??
      (await this.fill(credential, repository, pull.number, pull, key, OPEN_TTL_SECONDS))
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

  async activity(scope: AccessScope, address: PullRequestAddress): Promise<GithubTimelineItem[]> {
    const repository = await this.repositoryOf(scope, address);
    const credential = await this.readCredential(scope, address.installationId);
    return this.pulls.listTimeline(credential, repository.fullName, address.number);
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

  /** Each open pull request's snapshot, and every gap with the refusal GitHub gave for it. */
  private snapshotsOf(
    credential: GithubCredential,
    repository: WorkspaceRepository,
    pulls: GithubPullRequestSummary[],
    ttlSeconds: number,
    budget: ReadBudget,
  ): Promise<RepositoryPulls<PullRequestSnapshot>> {
    return this.readMany(
      repository,
      pulls,
      budget,
      (pull) => snapshotKey(repository, pull.number, pull.updatedAt, true),
      (entry) => this.fill(credential, repository, entry.pull.number, null, entry.key, ttlSeconds),
    );
  }

  /**
   * The same for the closed pull requests the figures read. Their checks are
   * not read — nothing shows a closed pull request's checks, and they cost two
   * requests each — so these answer the shape that has no checks field, under
   * a cache key of their own, so opening one afterwards does not find a
   * snapshot with its checks missing.
   */
  private closedSnapshotsOf(
    credential: GithubCredential,
    repository: WorkspaceRepository,
    pulls: GithubPullRequestSummary[],
    ttlSeconds: number,
    budget: ReadBudget,
  ): Promise<RepositoryPulls<ClosedPullRequestSnapshot>> {
    return this.readMany(
      repository,
      pulls,
      budget,
      (pull) => snapshotKey(repository, pull.number, pull.updatedAt, false),
      (entry) => this.fillClosed(credential, repository, entry.pull.number, entry.key, ttlSeconds),
    );
  }

  /**
   * One fill decision, made before any read begins.
   *
   * The cache is probed for every pull request first, because one already
   * filled costs no GitHub request and must not draw on the budget. What is
   * left is reserved in a single synchronous call, in listing order, and only
   * those are read. The rest are `deferred`: not rows, so nothing shows a
   * lane, a checks state or a blocker nobody read (#244), and not read either
   * — paying a detail request per unfilled row on every `pullRequestsFilling`
   * tick was the fan-out this is here to stop (#247).
   */
  private async readMany<TSnapshot extends PullRequestRead>(
    repository: WorkspaceRepository,
    pulls: GithubPullRequestSummary[],
    budget: ReadBudget,
    keyOf: (pull: GithubPullRequestSummary) => string,
    fillOne: (entry: { pull: GithubPullRequestSummary; key: string }) => Promise<TSnapshot>,
  ): Promise<RepositoryPulls<TSnapshot>> {
    const keyed = pulls.map((pull) => ({ pull, key: keyOf(pull) }));
    const probed = await Promise.all(keyed.map((entry) => this.cache.get<TSnapshot>(entry.key)));
    const hits: TSnapshot[] = [];
    const misses: { pull: GithubPullRequestSummary; key: string }[] = [];
    for (const [index, entry] of keyed.entries()) {
      const hit = probed[index];
      if (hit) hits.push(hit);
      else misses.push(entry);
    }
    const granted = budget.reserve(misses.length);
    const settled = await Promise.allSettled(misses.slice(0, granted).map(fillOne));
    const snapshots = [
      ...hits,
      ...settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])),
    ];
    const gaps: ReadGap[] = settled.flatMap((result) =>
      result.status === 'rejected'
        ? [{ what: 'pull_requests' as const, refusal: refusalOf(result.reason) }]
        : [],
    );
    for (const snapshot of snapshots) {
      if (snapshot.files.refusal) gaps.push({ what: 'files', refusal: snapshot.files.refusal });
      const checks = (snapshot as { checks?: Part<GithubChecks> }).checks;
      if (checks?.refusal) gaps.push({ what: 'checks', refusal: checks.refusal });
      if (snapshot.reviews.refusal)
        gaps.push({ what: 'reviews', refusal: snapshot.reviews.refusal });
    }
    return { repository, snapshots, deferred: misses.length - granted, gaps };
  }

  /**
   * The pull request and its three parts. The pull request itself must be
   * read; files, checks and reviews each settle on their own, and a snapshot
   * with a refused part is cached only briefly so the next read asks again —
   * except one refused with "slow down", which is kept until the limit has had
   * time to lift.
   */
  private fill(
    credential: GithubCredential,
    repository: WorkspaceRepository,
    number: number,
    known: GithubPullRequestDetail | null,
    key: string,
    ttlSeconds: number,
  ): Promise<PullRequestSnapshot> {
    return this.once(key, async () => {
      const pull = await this.detailOf(credential, repository, number, known);
      const [files, checks, reviews] = await Promise.all([
        this.filesOf(credential, repository, pull.number),
        partOf(this.pulls.readChecks(credential, repository.fullName, pull.headSha)),
        partOf(this.pulls.listReviews(credential, repository.fullName, pull.number)),
      ]);
      const snapshot: PullRequestSnapshot = { repository, pull, files, checks, reviews };
      await this.cache.set(
        key,
        snapshot,
        ttlFor([files.refusal, checks.refusal, reviews.refusal], ttlSeconds),
      );
      return snapshot;
    });
  }

  /** The same without the checks, for the figures. */
  private fillClosed(
    credential: GithubCredential,
    repository: WorkspaceRepository,
    number: number,
    key: string,
    ttlSeconds: number,
  ): Promise<ClosedPullRequestSnapshot> {
    return this.once(key, async () => {
      const pull = await this.detailOf(credential, repository, number, null);
      const [files, reviews] = await Promise.all([
        this.filesOf(credential, repository, pull.number),
        partOf(this.pulls.listReviews(credential, repository.fullName, pull.number)),
      ]);
      const snapshot: ClosedPullRequestSnapshot = { repository, pull, files, reviews };
      await this.cache.set(key, snapshot, ttlFor([files.refusal, reviews.refusal], ttlSeconds));
      return snapshot;
    });
  }

  /**
   * One read per key at a time. `get` → read → `set` is not single-flight, so
   * two overlapping polls both missed and both spent the budget on the same
   * pull request. The TTL still has to be chosen from the refusals *after* the
   * read, so the duplicate is collapsed here rather than in the cache.
   */
  private once<T>(key: string, read: () => Promise<T>): Promise<T> {
    const running = this.inFlight.get(key);
    if (running) return running as Promise<T>;
    const started = read().finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, started);
    return started;
  }

  /**
   * A listing row carries no additions, deletions or mergeable state, so the
   * detail is a request of its own. A caller that has already read it says so
   * by passing it — asked of the value rather than stated by the caller, this
   * was a duck-check on a field a fixture happened to have.
   */
  private detailOf(
    credential: GithubCredential,
    repository: WorkspaceRepository,
    number: number,
    known: GithubPullRequestDetail | null,
  ): Promise<GithubPullRequestDetail> {
    return known
      ? Promise.resolve(known)
      : this.pulls.readPullRequest(credential, repository.fullName, number);
  }

  private filesOf(
    credential: GithubCredential,
    repository: WorkspaceRepository,
    number: number,
  ): Promise<Part<string[]>> {
    return partOf(
      this.pulls
        .listFiles(credential, repository.fullName, number)
        .then((list) => list.map((file) => file.path)),
    );
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

/**
 * A snapshot's cache key. `withChecks` is part of it because a read that left
 * the checks out must not be found by one that needs them: storing both under
 * one key meant opening a closed pull request within the six-hour window
 * reported its checks as unavailable.
 */
function snapshotKey(
  repository: WorkspaceRepository,
  number: number,
  updatedAt: string,
  withChecks: boolean,
): string {
  const parts = `${repository.installationId}:${repository.githubRepoId}:${number}:${updatedAt}`;
  return withChecks ? `github:pulls:snapshot:${parts}` : `github:pulls:snapshot:nochecks:${parts}`;
}

/**
 * How long a snapshot is kept. A part refused for a rate limit is held until
 * the limit has had time to lift, so the next poll does not earn the refusal
 * again; any other refused part is held briefly so the next read asks again.
 */
function ttlFor(refusals: (GithubRefusal | null)[], whole: number): number {
  if (refusals.includes('rate_limited')) return RATE_LIMITED_TTL_SECONDS;
  return refusals.some(Boolean) ? PARTIAL_TTL_SECONDS : whole;
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
