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
} as const satisfies Record<string, ErrorDefinition>;
