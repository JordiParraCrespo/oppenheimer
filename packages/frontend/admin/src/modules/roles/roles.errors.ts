import type { ErrorDefinition } from '@oppenheimer/frontend-core';

export const RolesErrors = {
  FETCH_LIST_FAILED: { code: 'ROLES_CLIENT_001', message: 'Failed to fetch roles' },
  CREATE_FAILED: { code: 'ROLES_CLIENT_002', message: 'Failed to create role' },
  UPDATE_FAILED: { code: 'ROLES_CLIENT_003', message: 'Failed to update role' },
  DELETE_FAILED: { code: 'ROLES_CLIENT_004', message: 'Failed to delete role' },
  FETCH_USER_ROLES_FAILED: {
    code: 'ROLES_CLIENT_005',
    message: 'Failed to fetch user roles',
  },
  ASSIGN_FAILED: { code: 'ROLES_CLIENT_006', message: 'Failed to assign roles' },
  FETCH_CATALOG_FAILED: {
    code: 'ROLES_CLIENT_007',
    message: 'Failed to fetch authorization catalog',
  },
} as const satisfies Record<string, ErrorDefinition>;
