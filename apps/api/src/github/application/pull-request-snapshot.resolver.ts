import { Inject, Injectable } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import { AppError } from '@oppenheimer/backend-core';
import { GithubErrors } from '../domain/github.errors';
import { GITHUB_PULLS } from '../github.di-tokens';
import type {
  GithubChecks,
  GithubCredential,
  GithubPullRequestDetail,
  GithubPullsPort,
  GithubRefusal,
} from '../infrastructure/github-pulls.port';
import type {
  ClosedPullRequestSnapshot,
  Part,
  PullRequestRead,
  PullRequestSnapshot,
  ReadGap,
  WorkspaceRepository,
} from './pull-request-access.port';

/** A repository's open list: short, so a merge or a new push shows on the next look. */
export const OPEN_TTL_SECONDS = 30;
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
 * One pull request filled with its parts, and cached under its snapshot key.
 * The queue, the figures and a pull request's own screen all fill through
 * here, so a fill is single-flight across all three: one instance per module,
 * one {@link once} map.
 */
@Injectable()
export class PullRequestSnapshotResolver {
  /** One fill per snapshot key at a time; see {@link once}. */
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(
    @Inject(GITHUB_PULLS)
    private readonly pulls: GithubPullsPort,
    private readonly cache: CacheService,
  ) {}

  /**
   * The pull request and its three parts. The pull request itself must be
   * read; files, checks and reviews each settle on their own, and a snapshot
   * with a refused part is cached only briefly so the next read asks again —
   * except one refused with "slow down", which is kept until the limit has had
   * time to lift.
   */
  fill(
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
  fillClosed(
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

/** The parts GitHub refused on one snapshot, each with its refusal. */
export function partGaps(snapshot: PullRequestRead & { checks?: Part<GithubChecks> }): ReadGap[] {
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
 * Where a repository's open pull requests are kept: the one GraphQL read, and
 * the REST listing it falls back to. A write forgets both.
 */
export function openListingKeys(
  credential: GithubCredential,
  repository: WorkspaceRepository,
): { graph: string; rest: string } {
  const at = `${cacheScopeOf(credential)}:${repository.githubRepoId}`;
  return { graph: `github:pulls:open-graph:${at}`, rest: `github:pulls:open:${at}` };
}

/** Where a repository's newest page of pull requests in a state is kept. */
export function listingKey(
  credential: GithubCredential,
  repository: WorkspaceRepository,
  state: 'open' | 'closed',
): string {
  return `github:pulls:${state}:${cacheScopeOf(credential)}:${repository.githubRepoId}`;
}

/**
 * A snapshot's cache key, under the credential's cache scope: what GitHub
 * answers one installation, or one token (§6.2), is never served to a read
 * made with another. `withChecks` is part of it because a read that left
 * the checks out must not be found by one that needs them: storing both under
 * one key meant opening a closed pull request within the six-hour window
 * reported its checks as unavailable.
 */
export function snapshotKey(
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
export function ttlFor(refusals: (GithubRefusal | null)[], whole: number): number {
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
export function refusalOf(error: unknown): GithubRefusal {
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
