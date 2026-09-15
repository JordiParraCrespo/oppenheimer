import type { ErrorDefinition } from '../core/errors';

export const ApiTokensErrors = {
  FETCH_LIST_FAILED: {
    code: 'TOKENS_CLIENT_001',
    message: 'Failed to load API tokens',
  },
  CREATE_FAILED: {
    code: 'TOKENS_CLIENT_002',
    message: 'Failed to create the API token',
  },
  FETCH_PERMISSIONS_FAILED: {
    code: 'TOKENS_CLIENT_003',
    message: 'Failed to load the permission catalog',
  },
  FETCH_CREDENTIAL_FAILED: {
    code: 'TOKENS_CLIENT_004',
    message: 'Failed to load the current credential',
  },
  REVOKE_FAILED: {
    code: 'TOKENS_CLIENT_005',
    message: 'Failed to revoke the API token',
  },
} as const satisfies Record<string, ErrorDefinition>;
