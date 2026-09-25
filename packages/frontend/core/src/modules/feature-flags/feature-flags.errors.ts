import type { ErrorDefinition } from '../core/errors';

export const FeatureFlagsErrors = {
  FETCH_FAILED: {
    code: 'FEATURE_FLAGS_CLIENT_001',
    message: 'Failed to fetch feature flags',
  },
} as const satisfies Record<string, ErrorDefinition>;
