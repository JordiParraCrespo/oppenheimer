import type { ErrorDefinition } from '@oppenheimer/frontend-core';

export const ProfileErrors = {
  FETCH_FAILED: {
    code: 'PROFILE_CLIENT_001',
    message: 'Failed to fetch profile',
  },
  UPDATE_FAILED: {
    code: 'PROFILE_CLIENT_002',
    message: 'Failed to update profile',
  },
  // PROFILE_CLIENT_003 and _004 belong to the kernel's user-settings module.
  UPLOAD_AVATAR_FAILED: {
    code: 'PROFILE_CLIENT_005',
    message: 'Failed to upload avatar',
  },
  DELETE_AVATAR_FAILED: {
    code: 'PROFILE_CLIENT_006',
    message: 'Failed to remove avatar',
  },
  /**
   * Raised before an upload starts (`ProfileService`); the server's
   * PROFILE_004 / PROFILE_005 remain the decisive checks.
   */
  AVATAR_TYPE_REJECTED: {
    code: 'PROFILE_CLIENT_010',
    message: 'That file type cannot be used as a profile picture',
  },
  AVATAR_TOO_LARGE: {
    code: 'PROFILE_CLIENT_011',
    message: 'That image is too large',
  },
  CHANGE_PASSWORD_FAILED: {
    code: 'PROFILE_CLIENT_007',
    message: 'Failed to change password',
  },
  FETCH_SESSIONS_FAILED: {
    code: 'PROFILE_CLIENT_008',
    message: 'Failed to fetch sessions',
  },
  REVOKE_SESSION_FAILED: {
    code: 'PROFILE_CLIENT_009',
    message: 'Failed to sign out that session',
  },
  CHANGE_EMAIL_FAILED: {
    code: 'PROFILE_CLIENT_012',
    message: 'Failed to send the confirmation to that address',
  },
  DELETE_ACCOUNT_FAILED: {
    code: 'PROFILE_CLIENT_013',
    message: 'Failed to delete the account',
  },
} as const satisfies Record<string, ErrorDefinition>;
