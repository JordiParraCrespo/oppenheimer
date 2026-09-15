import type { ErrorDefinition } from '../core/errors';

export const UsersErrors = {
  FETCH_LIST_FAILED: {
    code: 'USERS_CLIENT_001',
    message: 'Failed to fetch users',
  },
  FETCH_FAILED: {
    code: 'USERS_CLIENT_002',
    message: 'Failed to fetch user',
  },
  UPDATE_FAILED: {
    code: 'USERS_CLIENT_003',
    message: 'Failed to update user',
  },
  DELETE_FAILED: {
    code: 'USERS_CLIENT_004',
    message: 'Failed to delete user',
  },
} as const satisfies Record<string, ErrorDefinition>;
