import type { AccessScope } from '@oppenheimer/backend-authz';
import type { InstallationPullRequestAddress, ReviewSubmission } from './pull-request-access.port';

/**
 * What the Pull requests area does to a pull request on GitHub. Writes go
 * through the caller's own GitHub user token, so what GitHub records is what
 * that person did. With no user token a write is `GITHUB_012`, never somebody
 * else's. Each takes an address the App reaches: `requireApp`
 * (`app-address.policy.ts`) narrows one first.
 */
export interface PullRequestWritePort {
  submitReview(
    scope: AccessScope,
    userId: string,
    address: InstallationPullRequestAddress,
    review: ReviewSubmission,
  ): Promise<void>;
  addComment(
    scope: AccessScope,
    userId: string,
    address: InstallationPullRequestAddress,
    comment: { path: string; line: number; side: 'LEFT' | 'RIGHT'; body: string },
  ): Promise<void>;
  /**
   * Merges the head the caller last saw; GitHub's refusal is `GITHUB_014`.
   * With `expectedHead`, a head that has moved on since is `GITHUB_014` too,
   * and GitHub is not asked.
   */
  merge(
    scope: AccessScope,
    userId: string,
    address: InstallationPullRequestAddress,
    method: 'squash' | 'merge' | 'rebase',
    expectedHead?: string,
  ): Promise<void>;
  /** Asks GitHub to merge it, in the caller's name, once what it requires passes; false when GitHub will not. */
  enableAutoMerge(
    scope: AccessScope,
    userId: string,
    address: InstallationPullRequestAddress,
    method: 'squash' | 'merge' | 'rebase',
  ): Promise<boolean>;
}
