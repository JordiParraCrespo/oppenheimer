import { Inject, Injectable, Logger } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import type { AccessScope } from '../../authz/domain/access-scope.types';
import type { GithubInstallationRepositoryPort } from '../database/github-installation.repository.port';
import { planClosedReads } from '../domain/closed-read.policy';
import { GithubErrors } from '../domain/github.errors';
import { isInstallationAddress } from '../domain/repository-address.policy';
import { GITHUB_APP, GITHUB_INSTALLATION_REPOSITORY, GITHUB_PULLS } from '../github.di-tokens';
import type { GithubAppPort } from '../infrastructure/github-app.port';
import type {
  GithubChecks,
  GithubCredential,
  GithubOpenPullRequest,
  GithubPart,
  GithubPullRequestDetail,
  GithubPullRequestFile,
  GithubPullRequestSummary,
  GithubPullsPort,
  GithubRefusal,
  GithubReviewComment,
  GithubTimelineItem,
} from '../infrastructure/github-pulls.port';
import { GithubAccessResolver } from './github-access.resolver';
import { GithubUserGrantResolver } from './github-user-grant.resolver';
import {
  type ClosedPullRequestSnapshot,
  type InstallationAddress,
  type InstallationPullRequestAddress,
  type Part,
  type PullRequestAccessPort,
  type PullRequestAddress,
  type PullRequestRead,
  type PullRequestSnapshot,
  type ReadBudget,
  type ReadGap,
  type RepositoryAddress,
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
/** GitHub's page: Analytics lists one per repository, the newest closed. */
const PULLS_PER_PAGE = 100;

/**
 * Reads through the installation, cached briefly in Redis as GitHub's own
 * answers (`CacheService`, JSON) and never as a mirror; writes through the
 * caller's own user token. Both credentials, and the repository a read or
 * write names, come from {@link GithubAccessResolver}.
 */
@Injectable()
export class PullRequestAccessResolver implements PullRequestAccessPort {
  private readonly logger = new Logger(PullRequestAccessResolver.name);
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

  requireApp<T extends RepositoryAddress>(address: T): Extract<T, InstallationAddress> {
    if (isInstallationAddress(address)) return address;
    throw new AppError(GithubErrors.READ_ONLY_REPOSITORY, {
      detail: `Repository ${address.githubRepoId} is read through your own GitHub token.`,
    });
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

  /**
   * One GraphQL read answers every open pull request with its paths, checks
   * and reviews, so the queue is whole on its first answer and spends no
   * budget. What that read could not fill (a part past its page), or every
   * pull request when the read fell back to REST, is filled the long way on
   * the budget, by the one flow both sources share.
   */
  async openPullRequests(
    scope: AccessScope,
    repository: WorkspaceRepository,
    budget: ReadBudget,
  ): Promise<RepositoryPulls<PullRequestSnapshot>> {
    const read = await this.openRead(scope, repository);
    if (!read.ok) return refusedRepository(repository, read.refusal);
    // Kept under the key each pull request's own screen looks for, so opening
    // one from the queue reads nothing but its `updated_at`.
    await Promise.all(
      read.whole.map((snapshot) =>
        this.cache.set(
          snapshotKey(
            read.credential,
            repository,
            snapshot.pull.number,
            snapshot.pull.updatedAt,
            true,
          ),
          snapshot,
          ttlFor(
            [snapshot.files.refusal, snapshot.checks.refusal, snapshot.reviews.refusal],
            OPEN_TTL_SECONDS,
          ),
        ),
      ),
    );
    const filled = await this.readMany(
      repository,
      read.unfilled,
      budget,
      (pull) => snapshotKey(read.credential, repository, pull.number, pull.updatedAt, true),
      (entry) =>
        this.fill(
          read.credential,
          repository,
          entry.pull.number,
          read.known.get(entry.pull.number) ?? null,
          entry.key,
          OPEN_TTL_SECONDS,
        ),
    );
    return {
      repository,
      snapshots: [...read.whole, ...filled.snapshots],
      deferred: filled.deferred,
      gaps: [...read.whole.flatMap(partGaps), ...filled.gaps],
    };
  }

  /**
   * A repository's open pull requests as far as one read answers them: the
   * ones it gave whole, and the ones still to fill, with the detail already
   * read for each where there is one. The GraphQL read is the source; one it
   * fails for any reason but a rate limit falls back to the REST listing,
   * which leaves every pull request to fill.
   */
  private async openRead(
    scope: AccessScope,
    repository: WorkspaceRepository,
  ): Promise<
    | {
        ok: true;
        credential: GithubCredential;
        whole: PullRequestSnapshot[];
        unfilled: GithubPullRequestSummary[];
        known: Map<number, GithubPullRequestDetail>;
      }
    | { ok: false; refusal: GithubRefusal }
  > {
    let credential: GithubCredential;
    try {
      credential = await this.access.readCredential(scope, repository);
    } catch (error) {
      return { ok: false, refusal: refusalOf(error) };
    }
    try {
      const read = await this.cache.getOrSet(
        `github:pulls:open-graph:${cacheScopeOf(credential)}:${repository.githubRepoId}`,
        OPEN_TTL_SECONDS,
        () => this.pulls.listOpenPullRequests(credential, repository.fullName),
      );
      const whole: PullRequestSnapshot[] = [];
      const known = new Map<number, GithubPullRequestDetail>();
      for (const entry of read) {
        const snapshot = wholeSnapshot(repository, entry);
        if (snapshot) whole.push(snapshot);
        else known.set(entry.pull.number, entry.pull);
      }
      return { ok: true, credential, whole, unfilled: [...known.values()], known };
    } catch (error) {
      const refusal = refusalOf(error);
      if (refusal === 'rate_limited') return { ok: false, refusal };
      // Logged, because a fallback that answers is otherwise invisible: a
      // GraphQL answer this module misreads would quietly cost the old fan-out.
      this.logger.warn(
        {
          message: 'The open pull requests read fell back to REST',
          repository: repository.fullName,
          refusal,
        },
        error instanceof Error ? error.stack : String(error),
      );
      const listing = await this.list(scope, repository, 'open', OPEN_TTL_SECONDS);
      if (!listing.ok) return listing;
      return {
        ok: true,
        credential: listing.credential,
        whole: [],
        unfilled: listing.pulls,
        known: new Map(),
      };
    }
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
      const credential = await this.access.readCredential(scope, repository);
      const pulls = await this.cache.getOrSet(
        `github:pulls:${state}:${cacheScopeOf(credential)}:${repository.githubRepoId}`,
        ttlSeconds,
        () => this.pulls.listPullRequests(credential, repository.fullName, state, 1),
      );
      return { ok: true, credential, pulls };
    } catch (error) {
      return { ok: false, refusal: refusalOf(error) };
    }
  }

  async pullRequest(scope: AccessScope, address: PullRequestAddress): Promise<PullRequestSnapshot> {
    const repository = await this.access.repositoryOf(scope, address);
    const credential = await this.access.readCredential(scope, address);
    // Read live once to learn `updated_at`, so the snapshot key changes the moment GitHub's answer does.
    const pull = await this.pulls.readPullRequest(credential, repository.fullName, address.number);
    const key = snapshotKey(credential, repository, pull.number, pull.updatedAt, true);
    // One pull request on its own screen draws on no budget: it is the whole
    // of what the reader asked for.
    return (
      (await this.cache.get<PullRequestSnapshot>(key)) ??
      (await this.fill(credential, repository, pull.number, pull, key, OPEN_TTL_SECONDS))
    );
  }

  async files(scope: AccessScope, address: PullRequestAddress): Promise<GithubPullRequestFile[]> {
    const repository = await this.access.repositoryOf(scope, address);
    const credential = await this.access.readCredential(scope, address);
    return this.pulls.listFiles(credential, repository.fullName, address.number);
  }

  async reviewComments(
    scope: AccessScope,
    address: PullRequestAddress,
  ): Promise<GithubReviewComment[]> {
    const repository = await this.access.repositoryOf(scope, address);
    const credential = await this.access.readCredential(scope, address);
    return this.pulls.listReviewComments(credential, repository.fullName, address.number);
  }

  async activity(scope: AccessScope, address: PullRequestAddress): Promise<GithubTimelineItem[]> {
    const repository = await this.access.repositoryOf(scope, address);
    const credential = await this.access.readCredential(scope, address);
    return this.pulls.listTimeline(credential, repository.fullName, address.number);
  }

  async submitReview(
    scope: AccessScope,
    userId: string,
    address: InstallationPullRequestAddress,
    review: ReviewSubmission,
  ): Promise<void> {
    const { repository, writer, reader, head } = await this.forWrite(scope, userId, address);
    await this.pulls.createReview(writer, repository.fullName, address.number, {
      ...review,
      commitId: head,
    });
    await this.forget(reader, repository);
  }

  async addComment(
    scope: AccessScope,
    userId: string,
    address: InstallationPullRequestAddress,
    comment: { path: string; line: number; side: 'LEFT' | 'RIGHT'; body: string },
  ): Promise<void> {
    const { repository, writer, head } = await this.forWrite(scope, userId, address);
    await this.pulls.createReviewComment(writer, repository.fullName, address.number, {
      ...comment,
      commitId: head,
    });
  }

  async merge(
    scope: AccessScope,
    userId: string,
    address: InstallationPullRequestAddress,
    method: 'squash' | 'merge' | 'rebase',
    expectedHead?: string,
  ): Promise<void> {
    const { repository, writer, reader, head } = await this.forWrite(scope, userId, address);
    if (expectedHead && expectedHead !== head) {
      throw new AppError(GithubErrors.MERGE_REFUSED, {
        detail: `New commits were pushed to ${repository.fullName}#${address.number} since it was read (${expectedHead.slice(0, 7)} is now ${head.slice(0, 7)}); nothing was merged.`,
      });
    }
    await this.pulls.merge(writer, repository.fullName, address.number, method, head);
    await this.forget(reader, repository);
  }

  async enableAutoMerge(
    scope: AccessScope,
    userId: string,
    address: InstallationPullRequestAddress,
    method: 'squash' | 'merge' | 'rebase',
  ): Promise<boolean> {
    const { repository, writer, reader, head, nodeId } = await this.forWrite(
      scope,
      userId,
      address,
    );
    const enabled = await this.pulls.enableAutoMerge(writer, nodeId, method, head);
    await this.forget(reader, repository);
    return enabled;
  }

  /** The repository, the caller's own token and the head commit a write lands on. */
  private async forWrite(
    scope: AccessScope,
    userId: string,
    address: InstallationPullRequestAddress,
  ) {
    const repository = await this.access.repositoryOf(scope, address);
    const writer = await this.access.writeCredential(userId, address);
    const credential = await this.access.readCredential(scope, address);
    const pull = await this.pulls.readPullRequest(credential, repository.fullName, address.number);
    return { repository, writer, reader: credential, head: pull.headSha, nodeId: pull.nodeId };
  }

  private async forget(
    credential: GithubCredential,
    repository: WorkspaceRepository,
  ): Promise<void> {
    const at = `${cacheScopeOf(credential)}:${repository.githubRepoId}`;
    await Promise.all([
      this.cache.del(`github:pulls:open-graph:${at}`),
      this.cache.del(`github:pulls:open:${at}`),
    ]);
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
      (pull) => snapshotKey(credential, repository, pull.number, pull.updatedAt, false),
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
  private async readMany<TSnapshot extends PullRequestRead, TPull extends GithubPullRequestSummary>(
    repository: WorkspaceRepository,
    pulls: TPull[],
    budget: ReadBudget,
    keyOf: (pull: TPull) => string,
    fillOne: (entry: { pull: TPull; key: string }) => Promise<TSnapshot>,
  ): Promise<RepositoryPulls<TSnapshot>> {
    const keyed = pulls.map((pull) => ({ pull, key: keyOf(pull) }));
    const probed = await Promise.all(keyed.map((entry) => this.cache.get<TSnapshot>(entry.key)));
    const hits: TSnapshot[] = [];
    const misses: { pull: TPull; key: string }[] = [];
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
    gaps.push(...snapshots.flatMap(partGaps));
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
}

/** A refused listing: the repository's one gap, and no rows. */
function refusedRepository(
  repository: WorkspaceRepository,
  refusal: GithubRefusal,
): RepositoryPulls<PullRequestSnapshot> {
  return { repository, snapshots: [], deferred: 0, gaps: [{ what: 'repository', refusal }] };
}

/**
 * A pull request the one read answered whole, or null when a part ran past
 * its page: a part cut short is never shown as all of it (#244).
 */
function wholeSnapshot(
  repository: WorkspaceRepository,
  entry: GithubOpenPullRequest,
): PullRequestSnapshot | null {
  const files = settled(entry.files);
  const checks = settled(entry.checks);
  const reviews = settled(entry.reviews);
  if (!files || !checks || !reviews) return null;
  return { repository, pull: entry.pull, files, checks, reviews };
}

function settled<T>(part: GithubPart<T>): Part<T> | null {
  return part.refusal === 'past_page' ? null : part;
}

/** The parts GitHub refused on one snapshot, each with its refusal. */
function partGaps(snapshot: PullRequestRead & { checks?: Part<GithubChecks> }): ReadGap[] {
  const gaps: ReadGap[] = [];
  if (snapshot.files.refusal) gaps.push({ what: 'files', refusal: snapshot.files.refusal });
  if (snapshot.checks?.refusal) gaps.push({ what: 'checks', refusal: snapshot.checks.refusal });
  if (snapshot.reviews.refusal) gaps.push({ what: 'reviews', refusal: snapshot.reviews.refusal });
  return gaps;
}

/**
 * Whose answers a read may share: the installation, or the one token of a
 * person's that made it (§6.2). Never another's: two tokens of one GitHub
 * account share a budget, not what they can see.
 */
function cacheScopeOf(credential: GithubCredential): string {
  return credential.cacheScope ?? credential.bucket;
}

/**
 * A snapshot's cache key, under the credential's cache scope: what GitHub
 * answers one installation, or one token (§6.2), is never served to a read
 * made with another. `withChecks` is part of it because a read that left
 * the checks out must not be found by one that needs them: storing both under
 * one key meant opening a closed pull request within the six-hour window
 * reported its checks as unavailable.
 */
function snapshotKey(
  credential: GithubCredential,
  repository: WorkspaceRepository,
  number: number,
  updatedAt: string,
  withChecks: boolean,
): string {
  const parts = `${cacheScopeOf(credential)}:${repository.githubRepoId}:${number}:${updatedAt}`;
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
