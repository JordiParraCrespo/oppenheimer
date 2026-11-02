import { Inject, Injectable } from '@nestjs/common';
import { CacheService } from '@oppenheimer/backend-cache';
import { GITHUB_PULLS } from '../github.di-tokens';
import type {
  GithubChecks,
  GithubCredential,
  GithubPullRequestDetail,
  GithubPullsPort,
} from '../infrastructure/github-pulls.port';
import type {
  ClosedPullRequestSnapshot,
  Part,
  PullRequestRead,
  PullRequestSnapshot,
  ReadGap,
  WorkspaceRepository,
} from './pull-request-access.port';
import { refusalOf, ttlFor } from './pull-request-cache.policy';

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

async function partOf<T>(read: Promise<T>): Promise<Part<T>> {
  try {
    return { value: await read, refusal: null };
  } catch (error) {
    return { value: null, refusal: refusalOf(error) };
  }
}
