import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

/**
 * User domain error catalog. Surfaced as HTTP responses by the global
 * `AllExceptionsFilter` via `AppError`. `httpStatus` is a plain status code so
 * the domain stays free of any HTTP framework.
 */
export const UserErrors = {
  NOT_FOUND: {
    code: 'USER_001',
    message: 'User not found',
    httpStatus: 404,
  },
  /**
   * Usernames are unique across accounts and somebody else holds this one.
   * Raised by the profile's own update and by the repository when two
   * requests race for the same handle, so the loser gets this and not a 500.
   */
  USERNAME_TAKEN: {
    code: 'USER_002',
    message: 'That username is already taken',
    httpStatus: 409,
  },
} as const satisfies Record<string, ErrorDefinition>;
