import type { ErrorDefinition } from '@oppenheimer/frontend-core';

/**
 * Client-side fallbacks for the organizations module. These are used only when
 * the API could not be reached, or answered with something that is not a
 * problem document — whenever the server sent one, `toAppError` keeps the
 * server's `code`, `title` and `detail` instead (see `ORG_*` in the API's error
 * reference).
 */
export const OrganizationsErrors = {
  FETCH_LIST_FAILED: {
    code: 'ORGANIZATIONS_CLIENT_001',
    message: 'Failed to fetch organizations',
  },
  UPDATE_FAILED: {
    code: 'ORGANIZATIONS_CLIENT_009',
    message: 'Failed to update the organization',
  },
  CREATE_FAILED: {
    code: 'ORGANIZATIONS_CLIENT_012',
    message: 'Failed to create the organization',
  },
} as const satisfies Record<string, ErrorDefinition>;
