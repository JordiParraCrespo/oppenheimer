import type { ErrorDefinition } from '@oppenheimer/frontend-core';

export const ApiTokensErrors = {
  FETCH_PERMISSIONS_FAILED: {
    code: 'TOKENS_CLIENT_003',
    message: 'Failed to load the permission catalog',
  },
} as const satisfies Record<string, ErrorDefinition>;
