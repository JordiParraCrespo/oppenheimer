import type { ErrorDefinition } from '../core/errors';

export const UserSettingsErrors = {
  FETCH_FAILED: {
    code: 'PROFILE_CLIENT_003',
    message: 'Failed to fetch preferences',
  },
  UPDATE_FAILED: {
    code: 'PROFILE_CLIENT_004',
    message: 'Failed to update preferences',
  },
} as const satisfies Record<string, ErrorDefinition>;
