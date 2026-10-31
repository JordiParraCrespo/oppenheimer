import type { AccessScope } from '../../authz/domain/access-scope.types';
import type {
  GithubPullRequestFile,
  GithubReviewComment,
  GithubTimelineItem,
} from '../infrastructure/github-pulls.port';
import type { PullRequestAddress, PullRequestSnapshot } from './pull-request-access.port';

/**
 * One pull request as its own screen reads it, through the credential that
 * opens its repository. None of these draws on a page view's budget: one pull
 * request is the whole of what the reader asked for.
 */
export interface PullRequestReadPort {
  pullRequest(scope: AccessScope, address: PullRequestAddress): Promise<PullRequestSnapshot>;
  files(scope: AccessScope, address: PullRequestAddress): Promise<GithubPullRequestFile[]>;
  reviewComments(scope: AccessScope, address: PullRequestAddress): Promise<GithubReviewComment[]>;
  /** Its conversation: comments, commits, reviews and events, oldest first. */
  activity(scope: AccessScope, address: PullRequestAddress): Promise<GithubTimelineItem[]>;
}
