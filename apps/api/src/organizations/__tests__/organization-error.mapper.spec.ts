import type { ErrorDefinition } from '@oppenheimer/backend-ddd';
import { describe, expect, it } from 'vitest';
import { OrganizationErrors } from '../domain/organization.errors';
import { mapOrganizationError } from '../organization-error.mapper';

const map = (upstreamCode: string | undefined, status: number) =>
  mapOrganizationError({ upstreamCode, status });

describe('mapOrganizationError', () => {
  it('folds the codes a client branches on onto their catalog entry', () => {
    expect(map('ORGANIZATION_NOT_FOUND', 404)).toBe(OrganizationErrors.NOT_FOUND);
    expect(map('ORGANIZATION_SLUG_ALREADY_TAKEN', 409)).toBe(OrganizationErrors.SLUG_TAKEN);
    expect(map('MEMBER_NOT_FOUND', 404)).toBe(OrganizationErrors.MEMBER_NOT_FOUND);
    expect(map('INVITATION_NOT_FOUND', 404)).toBe(OrganizationErrors.INVITATION_NOT_FOUND);
    expect(map('TEAM_NOT_FOUND', 404)).toBe(OrganizationErrors.TEAM_NOT_FOUND);
  });

  it('groups synonymous upstream codes onto one entry', () => {
    // Better Auth distinguishes these by the wording of the sentence, not by
    // anything a client would do differently.
    expect(map('ORGANIZATION_ALREADY_EXISTS', 409)).toBe(OrganizationErrors.SLUG_TAKEN);
    expect(map('USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION', 403)).toBe(
      OrganizationErrors.NOT_A_MEMBER,
    );
    expect(map('YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION', 403)).toBe(
      OrganizationErrors.NOT_A_MEMBER,
    );
    expect(map('YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER', 400)).toBe(
      OrganizationErrors.LAST_OWNER,
    );
    expect(map('YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER', 400)).toBe(
      OrganizationErrors.LAST_OWNER,
    );
  });

  it('collapses the whole YOU_ARE_NOT_ALLOWED_TO_* family onto one entry', () => {
    // There are ~25 of these and Better Auth adds more each release; matching
    // the prefix means a new verb still maps, instead of falling through.
    for (const code of [
      'YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_ORGANIZATION',
      'YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_ORGANIZATION',
      'YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION',
      'YOU_ARE_NOT_ALLOWED_TO_SOMETHING_INVENTED_NEXT_RELEASE',
    ]) {
      expect(map(code, 403)).toBe(OrganizationErrors.INSUFFICIENT_ROLE);
    }
  });

  it('maps every limit code onto LIMIT_REACHED', () => {
    for (const code of [
      'YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS',
      'YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_TEAMS',
      'ORGANIZATION_MEMBERSHIP_LIMIT_REACHED',
      'INVITATION_LIMIT_REACHED',
      'TEAM_MEMBER_LIMIT_REACHED',
    ]) {
      expect(map(code, 409)).toBe(OrganizationErrors.LIMIT_REACHED);
    }
  });

  it('falls back to a status-derived entry for an unknown code', () => {
    expect(map('SOME_FUTURE_CODE', 404)).toBe(OrganizationErrors.NOT_FOUND);
    expect(map('SOME_FUTURE_CODE', 403)).toBe(OrganizationErrors.INSUFFICIENT_ROLE);
    expect(map('SOME_FUTURE_CODE', 409)).toBe(OrganizationErrors.LIMIT_REACHED);
    expect(map('SOME_FUTURE_CODE', 400)).toBe(OrganizationErrors.REQUEST_REJECTED);
    expect(map('SOME_FUTURE_CODE', 503)).toBe(OrganizationErrors.UPSTREAM_FAILED);
  });

  it('falls back on status when there is no upstream code at all', () => {
    expect(map(undefined, 404)).toBe(OrganizationErrors.NOT_FOUND);
    expect(map(undefined, 500)).toBe(OrganizationErrors.UPSTREAM_FAILED);
  });

  it('never returns an entry outside the catalog', () => {
    const catalog: Set<ErrorDefinition> = new Set(Object.values(OrganizationErrors));
    for (const status of [400, 401, 403, 404, 409, 422, 500, 502, 503]) {
      expect(catalog.has(map(undefined, status))).toBe(true);
      expect(catalog.has(map('WHATEVER', status))).toBe(true);
    }
  });
});
