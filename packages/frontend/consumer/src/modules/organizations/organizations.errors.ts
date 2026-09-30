import type { ErrorDefinition } from '@oppenheimer/frontend-core';

/**
 * Client-side fallbacks for the organizations module, used only when the API
 * could not be reached or answered with something that is not a problem
 * document. Whenever the server sent one, `toAppError` keeps its `code`,
 * `title` and `detail` instead — see `ORG_*` in the API's error reference.
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
  CHECK_SLUG_FAILED: {
    code: 'ORGANIZATIONS_CLIENT_013',
    message: 'Failed to check the address',
  },
} as const satisfies Record<string, ErrorDefinition>;
