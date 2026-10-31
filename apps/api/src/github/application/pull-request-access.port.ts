import type { InstallationAddress, RepositoryAddress } from '../domain/repository-address.types';
import type {
  GithubChecks,
  GithubPullRequestDetail,
  GithubPullRequestReview,
  GithubRefusal,
} from '../infrastructure/github-pulls.port';

/*
 * What the Pull requests area and GitHub trade
 * (`product/next-steps/0.2-pull-requests-api-plan.md`): the addresses,
 * repositories and snapshots shared by the four ports beside this file —
 * the directory, the listings, one pull request's reads, and the writes.
 */
export type {
  InstallationAddress,
  RepositoryAddress,
  RepositorySource,
  TokensAddress,
} from '../domain/repository-address.types';

/** What the caller can read of one repository, besides where it is. */
export interface RepositoryFacts {
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
}

/**
 * One repository the caller can read: one a workspace's installation covers,
 * or one only their own GitHub tokens open (§6.2), whichever token reads it.
 */
export type WorkspaceRepository = RepositoryAddress & RepositoryFacts;

/** The address of one pull request. */
export type PullRequestAddress = RepositoryAddress & { number: number };

/** A pull request the App reaches: what a write in the caller's name takes. */
export type InstallationPullRequestAddress = InstallationAddress & { number: number };

/**
 * One part of a pull request as GitHub answered it: the value, or the refusal
 * GitHub gave instead. An unread part is never an empty one (#244), so there
 * are two states and no third.
 *
 * A part a read could not afford is not represented here. It was tried once:
 * a `{ value: null, refusal: null }` "not yet" reuses the empty shape #244
 * forbids, and because the type is not a discriminant every
 * `value ?? []` / `value?.state ?? 'unavailable'` in the mapper compiled and
 * silently read it as "nobody reviewed" and "checks unavailable". A pull
 * request this read cannot fill is left out of the read instead — see
 * `RepositoryPulls.deferred`.
 */
export type Part<T> = { value: T; refusal: null } | { value: null; refusal: GithubRefusal };

/**
 * What one page view may still spend on filling pull requests. A pull request
 * already in the cache costs nothing and never draws on it; past the budget a
 * pull request is deferred to the next read.
 */
export interface ReadBudget {
  /**
   * Takes up to `wanted` slots and answers how many it got.
   *
   * Synchronous on purpose. The first cut spent the budget one slot at a time
   * *after* `await cache.get`, with one counter shared by the open and closed
   * halves of a `Promise.all`, so which half got the slots was whichever Redis
   * miss resumed first. A reservation that cannot span an `await` cannot race.
   */
  reserve(wanted: number): number;
}

/**
 * What every read of a pull request has: GitHub's own detail, the paths it
 * touches and its reviews, each read on its own.
 */
export interface PullRequestRead {
  repository: WorkspaceRepository;
  pull: GithubPullRequestDetail;
  files: Part<string[]>;
  reviews: Part<GithubPullRequestReview[]>;
}

/**
 * A pull request as the queue and the briefing read it: the above, plus its
 * checks on the head commit.
 */
export interface PullRequestSnapshot extends PullRequestRead {
  checks: Part<GithubChecks>;
}

/**
 * A closed pull request as the figures read it. It has no `checks` field at
 * all, rather than an empty or "unasked" one: nothing reads a closed pull
 * request's checks — the waiting breakdown is the open ones' — and they cost
 * two requests each. Leaving the field out is what makes that a compile error
 * instead of a row that quietly reports `checks_unavailable`.
 */
export type ClosedPullRequestSnapshot = PullRequestRead;

/** What GitHub did not give on a read of a repository, and the refusal it gave. */
export interface ReadGap {
  what: 'repository' | 'pull_requests' | 'files' | 'checks' | 'reviews';
  refusal: GithubRefusal;
}

/**
 * One repository's pull requests as far as GitHub answered: what it gave, and
 * each gap with GitHub's own refusal. A refused listing is one `repository`
 * gap and no snapshots.
 */
export interface RepositoryPulls<TSnapshot = PullRequestSnapshot> {
  repository: WorkspaceRepository;
  snapshots: TSnapshot[];
  /**
   * How many of this repository's pull requests the read had no budget left to
   * fill. They are deliberately not rows: a row whose parts nobody read would
   * have to show a lane, a checks state and a blocker nobody read (#244), and
   * it would jump as later polls filled it. The view leaves them out, says it
   * is still filling, and the next read brings them in.
   */
  deferred: number;
  gaps: ReadGap[];
}

export interface ReviewSubmission {
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
  body?: string;
  comments: { path: string; line: number; side: 'LEFT' | 'RIGHT'; body: string }[];
}
