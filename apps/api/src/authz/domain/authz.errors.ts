import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

/**
 * Authorization-kernel error catalog. Surfaced as RFC 7807 problem documents by
 * the global `AllExceptionsFilter` via `AppError`.
 *
 * `AUTHZ_002` (a route that declares no policy) is declared in
 * `auth/domain/auth.errors.ts`: `PoliciesGuard` is what raises it, the auth
 * module may not import this one, and a code is declared exactly once. It kept
 * its code and message, so the docs row and its translations are unchanged.
 */
export const AuthzErrors = {
  ACTIVE_ORGANIZATION_NOT_A_MEMBERSHIP: {
    code: 'AUTHZ_001',
    message: 'The active organization is not one of your memberships',
    httpStatus: 403,
  },
} as const satisfies Record<string, ErrorDefinition>;
