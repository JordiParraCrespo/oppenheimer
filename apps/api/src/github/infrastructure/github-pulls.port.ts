/**
 * GitHub's pull request endpoints, in this module's vocabulary, called with a
 * token the caller supplies: an installation token to read, the person's own
 * user token to act. Nothing of GitHub's wire shape crosses this line.
 */

export type GithubCheckState = 'passing' | 'failing' | 'running' | 'none';

/** Why GitHub did not answer a read, in the words a reader can act on. */
export type GithubRefusal = 'forbidden' | 'not_found' | 'rate_limited' | 'failed';

export interface GithubPullRequestSummary {
  number: number;
  title: string;
  htmlUrl: string;
  authorLogin: string;
  authorIsBot: boolean;
  draft: boolean;
  state: 'open' | 'closed';
  merged: boolean;
  headRef: string;
  headSha: string;
  baseRef: string;
  /** ISO 8601. */
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  /** Logins asked to review and not yet reviewed. Teams are left out. */
  requestedReviewers: string[];
}

export interface GithubPullRequestDetail extends GithubPullRequestSummary {
  /** GitHub's global node id, which its GraphQL API names a pull request by. */
  nodeId: string;
  body: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  /** Null while GitHub is still computing it. */
  mergeable: boolean | null;
  /** GitHub's `mergeable_state`: `clean`, `blocked`, `behind`, `dirty`, `unstable`, `draft`, `unknown`. */
  mergeableState: string;
  /** Whether the head branch lives in another repository than the base. */
  fromFork: boolean;
}

export interface GithubPullRequestFile {
  path: string;
  previousPath: string | null;
  status: string;
  additions: number;
  deletions: number;
  /** The file's unified diff; absent for a binary file or one too large for GitHub to show. */
  patch: string | null;
}

export interface GithubPullRequestReview {
  id: number;
  login: string;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';
  submittedAt: string | null;
}

export interface GithubReviewComment {
  id: number;
  path: string;
  line: number | null;
  side: 'LEFT' | 'RIGHT';
  body: string;
  login: string;
  createdAt: string;
}

/** What else happened on a pull request that its timeline names. */
export type GithubTimelineEvent =
  | 'review_requested'
  | 'merged'
  | 'closed'
  | 'reopened'
  | 'ready_for_review'
  | 'convert_to_draft'
  | 'head_ref_force_pushed';

/**
 * One entry of a pull request's conversation, oldest first: a comment, a
 * pushed commit, a review, or an event. `id` is unique within the timeline.
 */
export type GithubTimelineItem =
  | { kind: 'comment'; id: string; login: string; body: string; at: string }
  | { kind: 'commit'; id: string; sha: string; login: string; message: string; at: string }
  | {
      kind: 'review';
      id: string;
      login: string;
      state: 'approved' | 'changes_requested' | 'commented' | 'dismissed';
      body: string;
      at: string;
    }
  | {
      kind: 'event';
      id: string;
      login: string;
      event: GithubTimelineEvent;
      /** Who a review was asked of; null for the other events. */
      subject: string | null;
      at: string;
    };

export interface GithubChecks {
  state: GithubCheckState;
  total: number;
  passed: number;
  failed: number;
  pending: number;
}

/**
 * An open pull request read whole in one request: its detail, the paths it
 * touches, its checks on the head commit and its reviews.
 */
export interface GithubOpenPullRequest {
  pull: GithubPullRequestDetail;
  files: GithubPart<string[]>;
  checks: GithubPart<GithubChecks>;
  reviews: GithubPart<GithubPullRequestReview[]>;
}

/**
 * One part of that read: the value, GitHub's refusal, or `past_page` when
 * the part ran longer than the read's page. That one is not a refusal: the
 * caller reads the pull request the long way rather than show part of a list
 * as all of it (#244).
 */
export type GithubPart<T> =
  | { value: T; refusal: null }
  | { value: null; refusal: GithubRefusal }
  | { value: null; refusal: 'past_page' };

export interface GithubReviewInput {
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
  body?: string;
  commitId: string;
  comments: { path: string; line: number; side: 'LEFT' | 'RIGHT'; body: string }[];
}

/**
 * What GitHub counts a call against, which is what a rate-limit pause covers:
 * the App's own JWT, the OAuth exchange, an installation (every token minted
 * for it shares one budget), or a person (every token of theirs shares one).
 */
export type GithubBucket = 'app' | 'oauth' | `installation:${number}` | `user:${number}`;

/** A token and the budget GitHub counts it against, which only the caller knows. */
export interface GithubCredential {
  token: string;
  bucket: GithubBucket;
}

export interface GithubPullsPort {
  /** Newest first; `maxPages` of a hundred bounds a busy repository. */
  listPullRequests(
    credential: GithubCredential,
    fullName: string,
    state: 'open' | 'closed',
    maxPages: number,
  ): Promise<GithubPullRequestSummary[]>;
  /**
   * Every open pull request of a repository, newest update first, each with
   * its paths, checks and reviews: one GraphQL request a page, in place of a
   * listing and four requests per pull request.
   */
  listOpenPullRequests(
    credential: GithubCredential,
    fullName: string,
  ): Promise<GithubOpenPullRequest[]>;
  readPullRequest(
    credential: GithubCredential,
    fullName: string,
    number: number,
  ): Promise<GithubPullRequestDetail>;
  listFiles(
    credential: GithubCredential,
    fullName: string,
    number: number,
  ): Promise<GithubPullRequestFile[]>;
  listReviews(
    credential: GithubCredential,
    fullName: string,
    number: number,
  ): Promise<GithubPullRequestReview[]>;
  listReviewComments(
    credential: GithubCredential,
    fullName: string,
    number: number,
  ): Promise<GithubReviewComment[]>;
  /** The conversation tab: comments, commits, reviews and events, oldest first. */
  listTimeline(
    credential: GithubCredential,
    fullName: string,
    number: number,
  ): Promise<GithubTimelineItem[]>;
  readChecks(credential: GithubCredential, fullName: string, sha: string): Promise<GithubChecks>;
  createReview(
    credential: GithubCredential,
    fullName: string,
    number: number,
    review: GithubReviewInput,
  ): Promise<void>;
  createReviewComment(
    credential: GithubCredential,
    fullName: string,
    number: number,
    comment: { commitId: string; path: string; line: number; side: 'LEFT' | 'RIGHT'; body: string },
  ): Promise<void>;
  /** Merges at `sha` only, so a push that lands meanwhile is never merged unseen. */
  merge(
    credential: GithubCredential,
    fullName: string,
    number: number,
    method: 'squash' | 'merge' | 'rebase',
    sha: string,
  ): Promise<void>;
  /**
   * Turns on GitHub's auto-merge at `sha`, so the pull request merges itself
   * once its required checks and reviews pass. False when GitHub would not:
   * the repository does not allow auto-merge, or nothing is left to wait for.
   */
  enableAutoMerge(
    credential: GithubCredential,
    nodeId: string,
    method: 'squash' | 'merge' | 'rebase',
    sha: string,
  ): Promise<boolean>;
}
