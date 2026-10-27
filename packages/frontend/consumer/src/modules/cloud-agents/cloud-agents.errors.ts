import type { ErrorDefinition } from '@oppenheimer/frontend-core';

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
  LIST_FAILED: {
    code: 'CLOUD_AGENTS_CLIENT_004',
    message: 'Failed to load cloud agents',
  },
  LOAD_FAILED: {
    code: 'CLOUD_AGENTS_CLIENT_005',
    message: 'Failed to load the cloud agent',
  },
  LAUNCH_FAILED: {
    code: 'CLOUD_AGENTS_CLIENT_006',
    message: 'Failed to launch the cloud agent',
  },
  FOLLOW_UP_FAILED: {
    code: 'CLOUD_AGENTS_CLIENT_007',
    message: 'Failed to send the follow-up',
  },
  CANCEL_FAILED: {
    code: 'CLOUD_AGENTS_CLIENT_008',
    message: 'Failed to stop the cloud agent',
  },
  MODELS_FAILED: {
    code: 'CLOUD_AGENTS_CLIENT_009',
    message: 'Failed to load the provider’s models',
  },
  REPOSITORIES_FAILED: {
    code: 'CLOUD_AGENTS_CLIENT_010',
    message: 'Failed to load the provider’s repositories',
  },
} as const satisfies Record<string, ErrorDefinition>;
