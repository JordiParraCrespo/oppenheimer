import type { ErrorDefinition } from '@oppenheimer/frontend-core';

export const PermissionsErrors = {
  FETCH_CATALOG_FAILED: {
    code: 'PERMISSIONS_CLIENT_001',
    message: 'Failed to load the permission catalog',
  },
} as const satisfies Record<string, ErrorDefinition>;
