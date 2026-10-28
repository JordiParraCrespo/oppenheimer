import type { ErrorDefinition } from '@oppenheimer/frontend-core';

/** `004`–`008` and `010` were the agent list's, page's and launch form's; retired with them. */
export const CloudAgentsErrors = {
  STATUS_FAILED: {
    code: 'CLOUD_AGENTS_CLIENT_001',
    message: 'Failed to read which cloud agent providers are connected',
  },
  CONNECT_FAILED: {
    code: 'CLOUD_AGENTS_CLIENT_002',
    message: 'Failed to connect the cloud agent provider',
  },
  DISCONNECT_FAILED: {
    code: 'CLOUD_AGENTS_CLIENT_003',
    message: 'Failed to disconnect the cloud agent provider',
  },
  MODELS_FAILED: {
    code: 'CLOUD_AGENTS_CLIENT_009',
    message: 'Failed to load the provider’s models',
  },
} as const satisfies Record<string, ErrorDefinition>;
