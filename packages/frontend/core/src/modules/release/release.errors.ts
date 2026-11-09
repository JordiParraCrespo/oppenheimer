import type { ErrorDefinition } from '../core/errors';

export const ReleaseErrors = {
  FETCH_FAILED: {
    code: 'RELEASE_CLIENT_001',
    message: 'Failed to fetch the API version',
  },
} as const satisfies Record<string, ErrorDefinition>;
