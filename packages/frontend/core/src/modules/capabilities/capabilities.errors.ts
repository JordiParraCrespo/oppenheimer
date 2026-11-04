import type { ErrorDefinition } from '../core/errors';

export const CapabilitiesErrors = {
  FETCH_FAILED: {
    code: 'CAPABILITIES_CLIENT_001',
    message: 'Failed to fetch deployment capabilities',
  },
  VERSION_FETCH_FAILED: {
    code: 'CAPABILITIES_CLIENT_002',
    message: 'Failed to fetch the API version',
  },
} as const satisfies Record<string, ErrorDefinition>;
