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
  body: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  /** Null while GitHub is still computing it. */
  mergeable: boolean | null;
  /** GitHub's `mergeable_state`: `clean`, `blocked`, `behind`, `dirty`, `unstable`, `draft`, `unknown`. */
  mergeableState: string;
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

export interface GithubChecks {
  state: GithubCheckState;
  total: number;
  passed: number;
  failed: number;
  pending: number;
}

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
}
