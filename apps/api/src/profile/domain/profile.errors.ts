import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

/**
 * Profile domain error catalog. Surfaced as RFC 7807 problem documents by the
 * global `AllExceptionsFilter` via `AppError`; `httpStatus` is a plain status
 * code so the domain stays free of any HTTP framework.
 *
 * Every code here also needs a row in `apps/docs/docs/errors.md` and a message
 * in each locale — `src/__tests__/error-catalog-coverage.spec.ts` fails the
 * build otherwise.
 */
export const ProfileErrors = {
  NOT_FOUND: {
    code: 'PROFILE_001',
    message: 'Profile not found',
    httpStatus: 404,
  },
  /**
   * Deliberately distinct from a validation failure: the client needs to know
   * the *current* password was wrong, not that the form was malformed.
   */
  INCORRECT_PASSWORD: {
    code: 'PROFILE_002',
    message: 'The current password is incorrect',
    httpStatus: 400,
  },
  SESSION_NOT_FOUND: {
    code: 'PROFILE_003',
    message: 'Session not found',
    httpStatus: 404,
  },
  UNSUPPORTED_IMAGE_TYPE: {
    code: 'PROFILE_004',
    message: 'That file type is not supported for an avatar',
    httpStatus: 415,
  },
  IMAGE_TOO_LARGE: {
    code: 'PROFILE_005',
    message: 'That image is too large',
    httpStatus: 413,
  },
  WEAK_PASSWORD: {
    code: 'PROFILE_006',
    message: 'The new password does not meet the password policy',
    httpStatus: 400,
  },
  /**
   * Revoking the session you are holding would sign you out mid-request with no
   * way to tell that from a failure. Signing out of the current device is what
   * the sign-out endpoint is for.
   */
  CANNOT_REVOKE_CURRENT_SESSION: {
    code: 'PROFILE_007',
    message: 'The session you are currently using cannot be revoked',
    httpStatus: 409,
  },
  /** Better Auth reached, but failed in a way the catalog does not name. */
  UPSTREAM_FAILURE: {
    code: 'PROFILE_008',
    message: 'The account service could not complete that request',
    httpStatus: 502,
  },
} as const satisfies Record<string, ErrorDefinition>;
