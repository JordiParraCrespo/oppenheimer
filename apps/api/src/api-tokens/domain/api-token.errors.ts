import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

/**
 * API token domain error catalog. Surfaced as HTTP responses by the global
 * `AllExceptionsFilter` via `AppError`.
 *
 * Authentication failures deliberately share one opaque code
 * (`TOKEN_003`): telling a caller whether a token is unknown, revoked or
 * expired hands an attacker a probing oracle. Authorization failures are
 * specific — the caller holds a valid credential and needs to know what it is
 * short of.
 */
export const ApiTokenErrors = {
  NOT_FOUND: {
    code: 'TOKEN_001',
    message: 'API token not found',
    httpStatus: 404,
  },
  SCOPES_EXCEED_GRANTER: {
    code: 'TOKEN_002',
    message: 'A token cannot be granted permissions its creator does not hold',
    httpStatus: 403,
  },
  INVALID_CREDENTIAL: {
    code: 'TOKEN_003',
    message: 'Invalid or expired API token',
    httpStatus: 401,
  },
  IP_NOT_ALLOWED: {
    code: 'TOKEN_004',
    message: 'This API token may not be used from this IP address',
    httpStatus: 403,
  },
  INSUFFICIENT_SCOPE: {
    code: 'TOKEN_005',
    message: 'This credential is missing a permission required by this endpoint',
    httpStatus: 403,
  },
  ENDPOINT_NOT_TOKEN_ACCESSIBLE: {
    code: 'TOKEN_006',
    message: 'This endpoint cannot be called with a scoped credential',
    httpStatus: 403,
  },
  ORGANIZATION_OUT_OF_SCOPE: {
    code: 'TOKEN_007',
    message: 'This credential is not scoped to that organization',
    httpStatus: 403,
  },
  NOT_A_MEMBER: {
    code: 'TOKEN_008',
    message: 'A token can only be scoped to organizations its creator belongs to',
    httpStatus: 403,
  },
  LIMIT_REACHED: {
    code: 'TOKEN_009',
    message: 'The maximum number of active API tokens has been reached',
    httpStatus: 409,
  },
} as const satisfies Record<string, ErrorDefinition>;
