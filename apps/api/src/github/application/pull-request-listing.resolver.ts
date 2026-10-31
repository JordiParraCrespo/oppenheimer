import { Inject, Injectable, Logger } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import type { AccessScope } from '../../authz/domain/access-scope.types';
import { planClosedReads } from '../domain/closed-read.policy';
import { GITHUB_PULLS } from '../github.di-tokens';
import type {
  GithubCredential,
  GithubOpenPullRequest,
  GithubPart,
  GithubPullRequestDetail,
  GithubPullRequestSummary,
  GithubPullsPort,
  GithubRefusal,
} from '../infrastructure/github-pulls.port';
import { GithubAccessResolver } from './github-access.resolver';
import type {
  ClosedPullRequestSnapshot,
  Part,
  PullRequestRead,
  PullRequestSnapshot,
  ReadBudget,
  ReadGap,
  RepositoryPulls,
  WorkspaceRepository,
} from './pull-request-access.port';
import type { PullRequestListingPort } from './pull-request-listing.port';
import {
  listingKey,
  OPEN_TTL_SECONDS,
  openListingKeys,
  PullRequestSnapshotResolver,
  partGaps,
  refusalOf,
  snapshotKey,
  ttlFor,
} from './pull-request-snapshot.resolver';

/** A closed pull request no longer changes: its snapshot is kept for most of a day. */
const CLOSED_SNAPSHOT_TTL_SECONDS = 6 * 3600;
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
/** GitHub's page: Analytics lists one per repository, the newest closed. */
const PULLS_PER_PAGE = 100;

/**
 * The queue's and the figures' reads through the installation, or the
 * caller's own token (§6.2), cached briefly in Redis as GitHub's own answers
 * (`CacheService`, JSON) and never as a mirror. Each pull request is filled by
 * {@link PullRequestSnapshotResolver}, on the page view's budget.
 */
@Injectable()
export class PullRequestListingResolver implements PullRequestListingPort {
  private readonly logger = new Logger(PullRequestListingResolver.name);

  constructor(
    @Inject(GITHUB_PULLS)
    private readonly pulls: GithubPullsPort,
    private readonly cache: CacheService,
    private readonly access: GithubAccessResolver,
    private readonly snapshots: PullRequestSnapshotResolver,
  ) {}

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
        this.snapshots.fill(
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
        openListingKeys(credential, repository).graph,
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
        listingKey(credential, repository, state),
        ttlSeconds,
        () => this.pulls.listPullRequests(credential, repository.fullName, state, 1),
      );
      return { ok: true, credential, pulls };
    } catch (error) {
      return { ok: false, refusal: refusalOf(error) };
    }
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
      (entry) =>
        this.snapshots.fillClosed(credential, repository, entry.pull.number, entry.key, ttlSeconds),
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
