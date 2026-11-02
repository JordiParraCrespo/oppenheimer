import type { AccessScope } from '@oppenheimer/backend-authz';
import type { GithubPullRequestSummary } from '../infrastructure/github-pulls.port';
import type {
  ClosedPullRequestSnapshot,
  ReadBudget,
  RepositoryPulls,
  WorkspaceRepository,
} from './pull-request-access.port';

/**
 * A repository's pull requests as the queue and the figures read them, each
 * filled with its parts as far as one page view's budget goes. Read through
 * the workspace's installations, or the caller's own token for a repository
 * only it opens (§6.2), and cached briefly as GitHub's own answers.
 */
export interface PullRequestListingPort {
  /**
   * What one page view may spend on filling pull requests' parts, shared by
   * every call it makes. Opened by `readBudget()` and passed along, so the
   * ceiling belongs to the view and not to each repository under it (#247).
   */
  readBudget(): ReadBudget;
  /** One repository's open pull requests, each with its paths, checks and reviews. Never throws for GitHub's refusals. */
  openPullRequests(
    scope: AccessScope,
    repository: WorkspaceRepository,
    budget: ReadBudget,
  ): Promise<RepositoryPulls>;
  /**
   * The pull requests closed since a moment across the repositories, the
   * `limit` most recently closed of them read in full; `complete` is false
   * when there were more.
   */
  closedPullRequests(
    scope: AccessScope,
    repositories: WorkspaceRepository[],
    since: Date,
    limit: number,
    budget: ReadBudget,
  ): Promise<{
    pulls: RepositoryPulls<ClosedPullRequestSnapshot>[];
    /** Every pull request in the window as its listing gave it, filled or not: what the figures count. */
    counted: GithubPullRequestSummary[];
    complete: boolean;
  }>;
}
