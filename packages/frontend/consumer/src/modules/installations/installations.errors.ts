import type { ErrorDefinition } from '@oppenheimer/frontend-core';

/**
 * Client-side fallbacks for the installations module, used only when the API
 * could not be reached or answered with something that is not a problem
 * document. Whenever the server sent one, `toAppError` keeps its `code`,
 * `title` and `detail` instead — see `GITHUB_*` in the API's error reference.
 */
export const InstallationsErrors = {
  FETCH_LIST_FAILED: {
    code: 'INSTALLATIONS_CLIENT_001',
    message: 'Failed to load GitHub installations',
  },
  CONNECT_FAILED: {
    code: 'INSTALLATIONS_CLIENT_002',
    message: 'Failed to connect the GitHub installation',
  },
  REMOVE_FAILED: {
    code: 'INSTALLATIONS_CLIENT_003',
    message: 'Failed to disconnect the GitHub installation',
  },
  FETCH_REPOSITORIES_FAILED: {
    code: 'INSTALLATIONS_CLIENT_004',
    message: 'Failed to load repositories',
  },
} as const satisfies Record<string, ErrorDefinition>;
