import type { ErrorDefinition } from '@oppenheimer/backend-ddd';
import { type BetterAuthFailure, betterAuthInvoker } from '../auth/infrastructure/better-auth.util';
import { OrganizationErrors } from './domain/organization.errors';

/**
 * Better Auth's `ORGANIZATION_ERROR_CODES` → this module's catalog.
 *
 * Only codes whose distinction a client would act on are listed. Everything
 * else falls through to {@link fallbackFor}, which picks an entry from the HTTP
 * status — so a code added by a future Better Auth release still produces a
 * sensible, documented problem instead of an unhandled 500. The upstream code
 * survives on the problem document either way (`upstreamCode`).
 *
 * Better Auth phrases most authorization failures as
 * `YOU_ARE_NOT_ALLOWED_TO_<verb>`; rather than listing all ~25 of them, the
 * prefix is matched in {@link mapOrganizationError}.
 */
const BY_UPSTREAM_CODE: Readonly<Record<string, ErrorDefinition>> = {
  ORGANIZATION_NOT_FOUND: OrganizationErrors.NOT_FOUND,

  ORGANIZATION_ALREADY_EXISTS: OrganizationErrors.SLUG_TAKEN,
  ORGANIZATION_SLUG_ALREADY_TAKEN: OrganizationErrors.SLUG_TAKEN,

  USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION: OrganizationErrors.NOT_A_MEMBER,
  YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION: OrganizationErrors.NOT_A_MEMBER,
  INVITER_IS_NO_LONGER_A_MEMBER_OF_THE_ORGANIZATION: OrganizationErrors.NOT_A_MEMBER,

  MEMBER_NOT_FOUND: OrganizationErrors.MEMBER_NOT_FOUND,
  USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION: OrganizationErrors.ALREADY_A_MEMBER,

  YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER: OrganizationErrors.LAST_OWNER,
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER: OrganizationErrors.LAST_OWNER,

  INVITATION_NOT_FOUND: OrganizationErrors.INVITATION_NOT_FOUND,
  FAILED_TO_RETRIEVE_INVITATION: OrganizationErrors.INVITATION_NOT_FOUND,
  YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION: OrganizationErrors.INVITATION_NOT_FOR_YOU,
  USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION: OrganizationErrors.ALREADY_INVITED,
  EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION:
    OrganizationErrors.EMAIL_VERIFICATION_REQUIRED,
  EMAIL_VERIFICATION_REQUIRED_FOR_INVITATION: OrganizationErrors.EMAIL_VERIFICATION_REQUIRED,

  TEAM_NOT_FOUND: OrganizationErrors.TEAM_NOT_FOUND,
  TEAM_ALREADY_EXISTS: OrganizationErrors.TEAM_ALREADY_EXISTS,
  USER_IS_NOT_A_MEMBER_OF_THE_TEAM: OrganizationErrors.NOT_A_MEMBER,

  ROLE_NOT_FOUND: OrganizationErrors.NOT_FOUND,
  ROLE_NAME_IS_ALREADY_TAKEN: OrganizationErrors.TEAM_ALREADY_EXISTS,

  YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS: OrganizationErrors.LIMIT_REACHED,
  YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_TEAMS: OrganizationErrors.LIMIT_REACHED,
  ORGANIZATION_MEMBERSHIP_LIMIT_REACHED: OrganizationErrors.LIMIT_REACHED,
  INVITATION_LIMIT_REACHED: OrganizationErrors.LIMIT_REACHED,
  TEAM_MEMBER_LIMIT_REACHED: OrganizationErrors.LIMIT_REACHED,
  TOO_MANY_ROLES: OrganizationErrors.LIMIT_REACHED,
};

/** Entry to use when the upstream code is unknown (or absent), keyed by status. */
function fallbackFor(status: number): ErrorDefinition {
  if (status === 401) return OrganizationErrors.NOT_A_MEMBER;
  if (status === 403) return OrganizationErrors.INSUFFICIENT_ROLE;
  if (status === 404) return OrganizationErrors.NOT_FOUND;
  if (status === 409) return OrganizationErrors.LIMIT_REACHED;
  if (status >= 500) return OrganizationErrors.UPSTREAM_FAILED;
  return OrganizationErrors.REQUEST_REJECTED;
}

export function mapOrganizationError({ upstreamCode, status }: BetterAuthFailure): ErrorDefinition {
  if (upstreamCode) {
    const known = BY_UPSTREAM_CODE[upstreamCode];
    if (known) return known;
    // Better Auth spells authorization failures as YOU_ARE_NOT_ALLOWED_TO_<verb>
    // — one entry covers every verb, present and future.
    if (upstreamCode.startsWith('YOU_ARE_NOT_ALLOWED_TO')) {
      return OrganizationErrors.INSUFFICIENT_ROLE;
    }
  }
  return fallbackFor(status);
}

/**
 * Wraps an `auth.api.*` organization/team/invitation call so its failures
 * become catalog `AppError`s. Every call in this module goes through it.
 */
export const invokeOrganizationApi = betterAuthInvoker(mapOrganizationError);
