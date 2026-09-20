import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

/**
 * API token domain error catalog. Surfaced as HTTP responses by the global
 * `AllExceptionsFilter` via `AppError`.
 *
 * These are the rules this module owns: what a token is, who may mint one and
 * how far it may be scoped. The refusals the auth kernel raises about a
 * *credential* — `TOKEN_003` for one it will not accept and `TOKEN_005`–`007`
 * for one that asks for more than it holds — belong to the kernel's catalog
 * (`auth/domain/auth.errors.ts`), because the kernel is what raises them and a
 * code may be declared only once. `TOKEN_003` stays deliberately opaque:
 * telling a caller whether a token is unknown, revoked or expired hands an
 * attacker a probing oracle. Authorization failures are specific — the caller
 * holds a valid credential and needs to know what it is short of.
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
  IP_NOT_ALLOWED: {
    code: 'TOKEN_004',
    message: 'This API token may not be used from this IP address',
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
