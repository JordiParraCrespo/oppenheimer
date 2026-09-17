import type { ErrorDefinition } from '@oppenheimer/frontend-core';

export const AdminUsersErrors = {
  FETCH_LIST_FAILED: { code: 'ADMIN_USERS_CLIENT_001', message: 'Failed to fetch admin users' },
  FETCH_FAILED: { code: 'ADMIN_USERS_CLIENT_002', message: 'Failed to fetch admin user' },
  CREATE_FAILED: { code: 'ADMIN_USERS_CLIENT_003', message: 'Failed to create admin user' },
  UPDATE_FAILED: { code: 'ADMIN_USERS_CLIENT_004', message: 'Failed to update admin user' },
  ACTION_FAILED: { code: 'ADMIN_USERS_CLIENT_005', message: 'Failed to manage admin user' },
} as const satisfies Record<string, ErrorDefinition>;
