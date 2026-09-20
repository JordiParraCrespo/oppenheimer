import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

/**
 * Authentication and authorization error catalog for the guards that protect
 * every route. Surfaced as HTTP responses by the global `AllExceptionsFilter`
 * via `AppError`.
 *
 * The first two are deliberately coarse. A guard knows only that the caller is
 * unauthenticated or that a rule said no — spelling out *which* rule, or
 * whether a session was absent versus expired, hands a caller a probing
 * oracle for the permission model. The specifics go to the server log.
 *
 * The `TOKEN_*` entries below are the refusals the kernel itself raises about
 * a credential: the resolver's "this is not a credential I accept" and the
 * three `ScopesGuard` returns when a scoped credential asks for more than it
 * holds. They keep the codes and messages they were published under — a code
 * is a client contract, and which module declares it is not — so
 * `apps/docs/docs/errors.md` still documents them under "API tokens".
 * What a *token* is short of (unknown id, ungrantable scopes, a membership it
 * does not have) stays in `ApiTokenErrors`, where that module's own rules are.
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
  /**
   * Deliberately a 500. A route that reached production without declaring what
   * it requires is a programming error, and reporting it as a client-side
   * permission problem would send whoever hits it looking in the wrong place.
   */
  ROUTE_HAS_NO_POLICY: {
    code: 'AUTHZ_002',
    message: 'This route declares no authorization policy',
    httpStatus: 500,
  },
  /**
   * One opaque answer for every unusable credential — unknown, revoked,
   * expired, or owned by an account that is gone or deactivated. Telling the
   * caller which it was would hand them a probing oracle.
   */
  INVALID_CREDENTIAL: {
    code: 'TOKEN_003',
    message: 'Invalid or expired API token',
    httpStatus: 401,
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
} as const satisfies Record<string, ErrorDefinition>;
