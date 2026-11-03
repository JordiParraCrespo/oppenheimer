import type { ErrorDefinition } from '@oppenheimer/frontend-core';

export const SentryClientErrors = {
  STATUS_FAILED: {
    code: 'SENTRY_CLIENT_001',
    message: 'Failed to read whether Sentry is connected',
  },
  CONNECT_FAILED: {
    code: 'SENTRY_CLIENT_002',
    message: 'Failed to connect Sentry',
  },
  DISCONNECT_FAILED: {
    code: 'SENTRY_CLIENT_003',
    message: 'Failed to disconnect Sentry',
  },
} as const satisfies Record<string, ErrorDefinition>;
