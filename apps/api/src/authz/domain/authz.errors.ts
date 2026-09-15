import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

/**
 * Authorization-kernel error catalog. Surfaced as RFC 7807 problem documents by
 * the global `AllExceptionsFilter` via `AppError`.
 */
export const AuthzErrors = {
  ACTIVE_ORGANIZATION_NOT_A_MEMBERSHIP: {
    code: 'AUTHZ_001',
    message: 'The active organization is not one of your memberships',
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
} as const satisfies Record<string, ErrorDefinition>;
