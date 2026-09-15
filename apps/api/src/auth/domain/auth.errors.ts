import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

/**
 * Authentication and authorization error catalog for the guards that protect
 * every route. Surfaced as HTTP responses by the global `AllExceptionsFilter`
 * via `AppError`.
 *
 * These are deliberately coarse. A guard knows only that the caller is
 * unauthenticated or that a rule said no — spelling out *which* rule, or
 * whether a session was absent versus expired, hands a caller a probing
 * oracle for the permission model. The specifics go to the server log.
 *
 * Credential-specific failures (an unknown API token, a missing scope) have
 * their own, more precise codes in `ApiTokenErrors` — there the caller already
 * holds a valid credential and needs to know what it is short of.
 */
export const AuthErrors = {
  UNAUTHENTICATED: {
    code: 'AUTH_001',
    message: 'Authentication required',
    httpStatus: 401,
  },
  FORBIDDEN: {
    code: 'AUTH_002',
    message: 'You do not have permission to perform this action',
    httpStatus: 403,
  },
} as const satisfies Record<string, ErrorDefinition>;
