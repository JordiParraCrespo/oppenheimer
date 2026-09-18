import type { ErrorDefinition } from '@oppenheimer/backend-ddd';
import { type BetterAuthFailure, betterAuthInvoker } from '../auth/infrastructure/better-auth.util';
import { ProfileErrors } from './domain/profile.errors';

/**
 * Better Auth's error codes → this module's catalog.
 *
 * Only codes a client would act on differently are listed; anything else falls
 * through to {@link fallbackFor}, which picks an entry from the HTTP status, so
 * a code added by a future Better Auth release still produces a documented
 * problem rather than an unhandled 500. The upstream code survives either way
 * as the `upstreamCode` extension member.
 */
const BY_UPSTREAM_CODE: Readonly<Record<string, ErrorDefinition>> = {
  INVALID_PASSWORD: ProfileErrors.INCORRECT_PASSWORD,
  INCORRECT_PASSWORD: ProfileErrors.INCORRECT_PASSWORD,
  // Better Auth answers a wrong current password on change-password with its
  // generic credentials code. Without this row it would surface as a bare
  // "request rejected" and the form could not point at the right field.
  INVALID_EMAIL_OR_PASSWORD: ProfileErrors.INCORRECT_PASSWORD,

  PASSWORD_TOO_SHORT: ProfileErrors.WEAK_PASSWORD,
  PASSWORD_TOO_LONG: ProfileErrors.WEAK_PASSWORD,

  SESSION_NOT_FOUND: ProfileErrors.SESSION_NOT_FOUND,
  // A credentials-less account (social sign-in only) has no password to change.
  CREDENTIAL_ACCOUNT_NOT_FOUND: ProfileErrors.INCORRECT_PASSWORD,
  USER_NOT_FOUND: ProfileErrors.NOT_FOUND,
};

/** Entry to use when the upstream code is unknown (or absent), keyed by status. */
function fallbackFor(status: number): ErrorDefinition {
  if (status === 400) return ProfileErrors.INCORRECT_PASSWORD;
  if (status === 401) return ProfileErrors.INCORRECT_PASSWORD;
  if (status === 404) return ProfileErrors.NOT_FOUND;
  return ProfileErrors.UPSTREAM_FAILURE;
}

export function mapProfileError({ upstreamCode, status }: BetterAuthFailure): ErrorDefinition {
  if (upstreamCode) {
    const known = BY_UPSTREAM_CODE[upstreamCode];
    if (known) return known;
  }
  return fallbackFor(status);
}

/**
 * Wraps an `auth.api.*` call made on the caller's own account so its failures
 * become catalog `AppError`s. Every Better Auth call in this module goes
 * through it.
 */
export const invokeProfileApi = betterAuthInvoker(mapProfileError);
