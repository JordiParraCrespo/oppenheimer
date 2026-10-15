import type { ErrorDefinition } from '@oppenheimer/frontend-core';

/**
 * Client-side fallbacks for the hosts module, used only when the API could not
 * be reached or answered with something that is not a problem document.
 */
export const HostsErrors = {
  FETCH_LIST_FAILED: {
    code: 'HOSTS_CLIENT_001',
    message: 'Failed to load hosts',
  },
  PAIR_FAILED: {
    code: 'HOSTS_CLIENT_002',
    message: 'Failed to create the host registration token',
  },
  REMOVE_FAILED: {
    code: 'HOSTS_CLIENT_003',
    message: 'Failed to remove the host',
  },
  RENAME_FAILED: {
    code: 'HOSTS_CLIENT_004',
    message: 'Failed to rename the host',
  },
  FETCH_FOLDERS_FAILED: {
    code: 'HOSTS_CLIENT_005',
    message: 'Failed to list the folders on the host',
  },
} as const satisfies Record<string, ErrorDefinition>;
