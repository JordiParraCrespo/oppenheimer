import type { ErrorDefinition } from '@oppenheimer/frontend-core';

/**
 * Client-side fallbacks for the pull requests module, used only when the API
 * could not be reached or answered with something that is not a problem
 * document. A refusal the API explains (`GITHUB_*`, `PULLS_*`) reaches the
 * screen with its own code.
 */
export const PullRequestsErrors = {
  FETCH_QUEUE_FAILED: { code: 'PULLS_CLIENT_001', message: 'Failed to load pull requests' },
  FETCH_FAILED: { code: 'PULLS_CLIENT_002', message: 'Failed to load the pull request' },
  FETCH_FILES_FAILED: { code: 'PULLS_CLIENT_003', message: 'Failed to load the changes' },
  REVIEW_FAILED: { code: 'PULLS_CLIENT_004', message: 'Failed to submit the review' },
  COMMENT_FAILED: { code: 'PULLS_CLIENT_005', message: 'Failed to add the comment' },
  MERGE_FAILED: { code: 'PULLS_CLIENT_006', message: 'Failed to merge' },
  FETCH_REPOSITORIES_FAILED: { code: 'PULLS_CLIENT_007', message: 'Failed to load repositories' },
  WATCH_FAILED: { code: 'PULLS_CLIENT_008', message: 'Failed to update the watched repositories' },
  FETCH_ANALYTICS_FAILED: { code: 'PULLS_CLIENT_009', message: 'Failed to load analytics' },
  FETCH_ACTIVITY_FAILED: { code: 'PULLS_CLIENT_010', message: 'Failed to load the activity' },
} as const satisfies Record<string, ErrorDefinition>;
