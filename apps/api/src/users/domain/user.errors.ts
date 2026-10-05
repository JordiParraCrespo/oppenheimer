import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

export const UserErrors = {
  NOT_FOUND: {
    code: 'USER_001',
    message: 'User not found',
    httpStatus: 404,
  },
  /**
   * Usernames are unique across accounts and somebody else holds this one.
   * The unique constraint decides; the repository reports its violation as
   * this rather than a 500.
   */
  USERNAME_TAKEN: {
    code: 'USER_002',
    message: 'That username is already taken',
    httpStatus: 409,
  },
  /**
   * Deleting your own account is confirmed by typing its email address;
   * what was typed was something else.
   */
  DELETE_CONFIRMATION_MISMATCH: {
    code: 'USER_003',
    message: 'The confirmation does not match your email address',
    httpStatus: 400,
  },
} as const satisfies Record<string, ErrorDefinition>;
