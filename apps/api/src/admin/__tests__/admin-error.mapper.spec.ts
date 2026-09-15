import type { ErrorDefinition } from '@oppenheimer/backend-ddd';
import { describe, expect, it } from 'vitest';
import { mapAdminError } from '../admin-error.mapper';
import { AdminErrors } from '../domain/admin.errors';

const map = (upstreamCode: string | undefined, status: number) =>
  mapAdminError({ upstreamCode, status });

describe('mapAdminError', () => {
  it('folds the codes a client branches on onto their catalog entry', () => {
    expect(map('USER_ALREADY_EXISTS', 409)).toBe(AdminErrors.USER_ALREADY_EXISTS);
    expect(map('USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', 409)).toBe(AdminErrors.USER_ALREADY_EXISTS);
    expect(map('BANNED_USER', 403)).toBe(AdminErrors.BANNED_USER);
    expect(map('INVALID_ROLE_TYPE', 400)).toBe(AdminErrors.INVALID_ROLE);
  });

  it('separates "you may not" from "not to yourself"', () => {
    // Both are 403s, but only one is fixable by granting the caller a role.
    expect(map('YOU_ARE_NOT_ALLOWED_TO_BAN_USERS', 403)).toBe(AdminErrors.NOT_ALLOWED);
    expect(map('YOU_CANNOT_BAN_YOURSELF', 400)).toBe(AdminErrors.SELF_TARGET_FORBIDDEN);
    expect(map('YOU_CANNOT_REMOVE_YOURSELF', 400)).toBe(AdminErrors.SELF_TARGET_FORBIDDEN);
    expect(map('YOU_CANNOT_IMPERSONATE_ADMINS', 403)).toBe(AdminErrors.SELF_TARGET_FORBIDDEN);
  });

  it('collapses the YOU_ARE_NOT_ALLOWED_TO_* family onto NOT_ALLOWED', () => {
    for (const code of [
      'YOU_ARE_NOT_ALLOWED_TO_LIST_USERS',
      'YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS',
      'YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS',
      'YOU_ARE_NOT_ALLOWED_TO_DO_SOMETHING_NEW',
    ]) {
      expect(map(code, 403)).toBe(AdminErrors.NOT_ALLOWED);
    }
  });

  it('keeps the more specific mapping for a code that also matches the prefix', () => {
    // Listed explicitly, so it must win over the YOU_ARE_NOT_ALLOWED_TO_ prefix.
    expect(map('YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE', 400)).toBe(
      AdminErrors.INVALID_ROLE,
    );
  });

  it('falls back to a status-derived entry for an unknown code', () => {
    expect(map('SOME_FUTURE_CODE', 404)).toBe(AdminErrors.USER_NOT_FOUND);
    expect(map('SOME_FUTURE_CODE', 403)).toBe(AdminErrors.NOT_ALLOWED);
    expect(map('SOME_FUTURE_CODE', 409)).toBe(AdminErrors.USER_ALREADY_EXISTS);
    expect(map('SOME_FUTURE_CODE', 400)).toBe(AdminErrors.REQUEST_REJECTED);
    expect(map(undefined, 500)).toBe(AdminErrors.UPSTREAM_FAILED);
  });

  it('never returns an entry outside the catalog', () => {
    const catalog: Set<ErrorDefinition> = new Set(Object.values(AdminErrors));
    for (const status of [400, 401, 403, 404, 409, 422, 500, 502, 503]) {
      expect(catalog.has(map(undefined, status))).toBe(true);
      expect(catalog.has(map('WHATEVER', status))).toBe(true);
    }
  });
});
