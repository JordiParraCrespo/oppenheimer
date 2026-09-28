import type { ErrorDefinition } from '../core/errors';

export const UsersErrors = {
  FETCH_FAILED: {
    code: 'USERS_CLIENT_002',
    message: 'Failed to fetch user',
  },
} as const satisfies Record<string, ErrorDefinition>;
