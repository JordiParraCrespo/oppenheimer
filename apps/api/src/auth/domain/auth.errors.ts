import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

/**
 * Error catalog for the guards that protect every route.
 *
 * The first two are deliberately coarse: naming which rule refused, or whether
 * a session was absent or expired, hands a caller a probing oracle for the
 * permission model. The specifics go to the server log.
 *
 * The `TOKEN_*` entries are the kernel's own refusals of a credential (the
 * resolver's and `ScopesGuard`'s). They keep the codes they were published
 * under, since a code is a client contract, so `apps/docs/docs/errors.md`
 * documents them under "API tokens". What a token itself is short of stays in
 * `ApiTokenErrors`.
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
   * An `@OrganizationScoped` route whose organization value is not a UUID,
   * refused before anything is looked up.
   */
  ROUTE_ORGANIZATION_INVALID: {
    code: 'AUTHZ_003',
    message: 'The organization this request names is not a valid id',
    httpStatus: 400,
  },
  /**
   * A 500 for the same reason as `AUTHZ_002`: `@OrganizationScoped` names a
   * parameter the route does not have, which no client request can cause.
   */
  ROUTE_ORGANIZATION_MISSING: {
    code: 'AUTHZ_004',
    message: 'This route names an organization parameter it does not declare',
    httpStatus: 500,
  },
  /**
   * One opaque answer for every unusable credential — unknown, revoked,
   * expired, or owned by an account that is gone, deactivated or banned.
   * Telling the caller which it was would hand them a probing oracle.
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
