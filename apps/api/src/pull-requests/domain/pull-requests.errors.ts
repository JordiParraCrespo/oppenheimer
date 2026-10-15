import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

export const PullRequestsErrors = {
  /** Pull requests are read through a workspace's installations; a caller acting globally has none. */
  NO_ACTIVE_ORGANIZATION: {
    code: 'PULLS_001',
    message: 'Pull requests belong to a workspace',
    httpStatus: 400,
  },
  /** A host fetches branches of the base repository; a fork's head is not one of them. */
  REVIEW_FROM_FORK: {
    code: 'PULLS_002',
    message: 'A pull request from a fork cannot be reviewed in a session yet',
    httpStatus: 409,
  },
} as const satisfies Record<string, ErrorDefinition>;
