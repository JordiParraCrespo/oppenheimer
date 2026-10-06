import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

export const PullRequestsErrors = {
  /** Pull requests are read through a workspace's installations; a caller acting globally has none. */
  NO_ACTIVE_ORGANIZATION: {
    code: 'PULLS_001',
    message: 'Pull requests belong to a workspace',
    httpStatus: 400,
  },
} as const satisfies Record<string, ErrorDefinition>;
