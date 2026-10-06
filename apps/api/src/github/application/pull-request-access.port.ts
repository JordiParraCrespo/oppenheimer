import type { AccessScope } from '@oppenheimer/backend-authz';
import type {
  GithubChecks,
  GithubPullRequestDetail,
  GithubPullRequestFile,
  GithubPullRequestReview,
  GithubReviewComment,
} from '../infrastructure/github-pulls.port';

/** One repository a workspace's installations cover, named by the installation that reaches it. */
export interface WorkspaceRepository {
  /** The control-plane installation row's uuid. */
  installationId: string;
  githubRepoId: number;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
}

/** The address of one pull request. */
export interface PullRequestAddress {
  installationId: string;
  githubRepoId: number;
  number: number;
}

/**
 * A pull request as the queue and the briefing read it: GitHub's own detail
 * plus the paths it touches, its checks on the head commit and its reviews.
 */
export interface PullRequestSnapshot {
  repository: WorkspaceRepository;
  pull: GithubPullRequestDetail;
  filePaths: string[];
  checks: GithubChecks;
  reviews: GithubPullRequestReview[];
}

export interface ReviewSubmission {
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
  body?: string;
  comments: { path: string; line: number; side: 'LEFT' | 'RIGHT'; body: string }[];
}

/**
 * The one door the Pull requests area reaches GitHub through
 * (`product/next-steps/0.2-pull-requests-api-plan.md`). Reads go through the
 * workspace's installations, scoped like every other repository read; writes go
 * through the caller's own GitHub user token, so what GitHub records is what that
 * person did. With no user token a write is `GITHUB_012`, never somebody else's.
 */
export interface PullRequestAccessPort {
  /** Every repository the workspace's usable installations cover. */
  repositories(scope: AccessScope): Promise<WorkspaceRepository[]>;
  /** The caller's GitHub login, when they have connected GitHub with a stored grant. */
  viewerLogin(userId: string): Promise<string | null>;
  /** One repository's open pull requests, each with its paths, checks and reviews. */
  openPullRequests(
    scope: AccessScope,
    repository: WorkspaceRepository,
  ): Promise<PullRequestSnapshot[]>;
  /** One repository's pull requests closed since a moment, newest first, each with its reviews. */
  closedPullRequests(
    scope: AccessScope,
    repository: WorkspaceRepository,
    since: Date,
  ): Promise<PullRequestSnapshot[]>;
  pullRequest(scope: AccessScope, address: PullRequestAddress): Promise<PullRequestSnapshot>;
  files(scope: AccessScope, address: PullRequestAddress): Promise<GithubPullRequestFile[]>;
  reviewComments(scope: AccessScope, address: PullRequestAddress): Promise<GithubReviewComment[]>;
  submitReview(
    scope: AccessScope,
    userId: string,
    address: PullRequestAddress,
    review: ReviewSubmission,
  ): Promise<void>;
  addComment(
    scope: AccessScope,
    userId: string,
    address: PullRequestAddress,
    comment: { path: string; line: number; side: 'LEFT' | 'RIGHT'; body: string },
  ): Promise<void>;
  /** Merges the head the caller last saw; GitHub's refusal is `GITHUB_014`. */
  merge(
    scope: AccessScope,
    userId: string,
    address: PullRequestAddress,
    method: 'squash' | 'merge' | 'rebase',
  ): Promise<void>;
}
