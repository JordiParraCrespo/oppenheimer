import type { ErrorDefinition } from '@oppenheimer/backend-ddd';
import { type BetterAuthFailure, betterAuthInvoker } from '../auth/infrastructure/better-auth.util';
import { AdminErrors } from './domain/admin.errors';

/**
 * Better Auth's `ADMIN_ERROR_CODES` → this module's catalog. Same shape as
 * `organizations/organization-error.mapper.ts`: known codes are folded onto a
 * catalog entry, the `YOU_ARE_NOT_ALLOWED_TO_*` family collapses to one entry,
 * and anything unrecognised falls back to a status-derived entry so a future
 * Better Auth code still produces a documented problem.
 */
const BY_UPSTREAM_CODE: Readonly<Record<string, ErrorDefinition>> = {
  USER_ALREADY_EXISTS: AdminErrors.USER_ALREADY_EXISTS,
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: AdminErrors.USER_ALREADY_EXISTS,

  YOU_CANNOT_BAN_YOURSELF: AdminErrors.SELF_TARGET_FORBIDDEN,
  YOU_CANNOT_REMOVE_YOURSELF: AdminErrors.SELF_TARGET_FORBIDDEN,
  YOU_CANNOT_IMPERSONATE_ADMINS: AdminErrors.SELF_TARGET_FORBIDDEN,

  INVALID_ROLE_TYPE: AdminErrors.INVALID_ROLE,
  YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE: AdminErrors.INVALID_ROLE,

  BANNED_USER: AdminErrors.BANNED_USER,

  NO_DATA_TO_UPDATE: AdminErrors.REQUEST_REJECTED,
  PASSWORD_CANNOT_BE_UPDATED_VIA_UPDATE_USER: AdminErrors.REQUEST_REJECTED,

  FAILED_TO_CREATE_USER: AdminErrors.UPSTREAM_FAILED,
};

/** Entry to use when the upstream code is unknown (or absent), keyed by status. */
function fallbackFor(status: number): ErrorDefinition {
  if (status === 401 || status === 403) return AdminErrors.NOT_ALLOWED;
  if (status === 404) return AdminErrors.USER_NOT_FOUND;
  if (status === 409) return AdminErrors.USER_ALREADY_EXISTS;
  if (status >= 500) return AdminErrors.UPSTREAM_FAILED;
  return AdminErrors.REQUEST_REJECTED;
}

export function mapAdminError({ upstreamCode, status }: BetterAuthFailure): ErrorDefinition {
  if (upstreamCode) {
    const known = BY_UPSTREAM_CODE[upstreamCode];
    if (known) return known;
    if (upstreamCode.startsWith('YOU_ARE_NOT_ALLOWED_TO')) {
      return AdminErrors.NOT_ALLOWED;
    }
  }
  return fallbackFor(status);
}

/**
 * Wraps an `auth.api.*` admin call so its failures become catalog `AppError`s.
 * Every call in this module goes through it.
 */
export const invokeAdminApi = betterAuthInvoker(mapAdminError);
