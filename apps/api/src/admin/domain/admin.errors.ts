import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

/**
 * Admin (user-administration) error catalog. Surfaced as HTTP responses by the
 * global `AllExceptionsFilter` via `AppError`.
 *
 * As with the organization catalog, Better Auth's admin plugin raises its own
 * `SCREAMING_SNAKE_CASE` codes; `admin-error.mapper.ts` folds them into these
 * entries and keeps the upstream code as an `upstreamCode` extension member.
 */
export const AdminErrors = {
  USER_NOT_FOUND: {
    code: 'ADMIN_001',
    message: 'User not found',
    httpStatus: 404,
  },
  USER_ALREADY_EXISTS: {
    code: 'ADMIN_002',
    message: 'A user with that email already exists',
    httpStatus: 409,
  },
  NOT_ALLOWED: {
    code: 'ADMIN_003',
    message: 'Your account is not allowed to perform this administrative action',
    httpStatus: 403,
  },
  SELF_TARGET_FORBIDDEN: {
    code: 'ADMIN_004',
    message: 'An administrator cannot perform this action on their own account',
    httpStatus: 403,
  },
  INVALID_ROLE: {
    code: 'ADMIN_005',
    message: 'That role does not exist or cannot be assigned',
    httpStatus: 400,
  },
  BANNED_USER: {
    code: 'ADMIN_006',
    message: 'That user is banned from this application',
    httpStatus: 403,
  },
  REQUEST_REJECTED: {
    code: 'ADMIN_007',
    message: 'The admin service rejected this request',
    httpStatus: 400,
  },
  UPSTREAM_FAILED: {
    code: 'ADMIN_008',
    message: 'The admin service failed to handle this request',
    httpStatus: 502,
  },
  SESSION_NOT_FOUND: {
    code: 'ADMIN_009',
    message: 'No such session for that user',
    httpStatus: 404,
  },
} as const satisfies Record<string, ErrorDefinition>;
