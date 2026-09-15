import type { ErrorDefinition } from '../core/errors';

export const CapabilitiesErrors = {
  FETCH_FAILED: {
    code: 'CAPABILITIES_CLIENT_001',
    message: 'Failed to fetch deployment capabilities',
  },
} as const satisfies Record<string, ErrorDefinition>;
