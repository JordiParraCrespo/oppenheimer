import { describe, expect, it } from 'vitest';
import { ProfileErrors } from '../domain/profile.errors';
import { mapProfileError } from '../profile-error.mapper';

describe('mapProfileError', () => {
  it('maps a wrong current password onto its own code', () => {
    // Better Auth reports this with its generic credentials code; without the
    // mapping the form could not point at the right field.
    expect(
      mapProfileError({
        upstreamCode: 'INVALID_EMAIL_OR_PASSWORD',
        status: 400,
      }),
    ).toBe(ProfileErrors.INCORRECT_PASSWORD);
    expect(mapProfileError({ upstreamCode: 'INVALID_PASSWORD', status: 400 })).toBe(
      ProfileErrors.INCORRECT_PASSWORD,
    );
  });

  it('maps password-policy failures apart from a wrong password', () => {
    expect(mapProfileError({ upstreamCode: 'PASSWORD_TOO_SHORT', status: 400 })).toBe(
      ProfileErrors.WEAK_PASSWORD,
    );
  });

  it('maps a missing session', () => {
    expect(mapProfileError({ upstreamCode: 'SESSION_NOT_FOUND', status: 404 })).toBe(
      ProfileErrors.SESSION_NOT_FOUND,
    );
  });

  it('treats a social-only account as a wrong password', () => {
    // There is no credential to verify. Saying so would confirm which accounts
    // sign in with a provider, so it answers exactly like a bad password.
    expect(
      mapProfileError({
        upstreamCode: 'CREDENTIAL_ACCOUNT_NOT_FOUND',
        status: 400,
      }),
    ).toBe(ProfileErrors.INCORRECT_PASSWORD);
  });

  it('is total: an unknown code still lands in the catalog', () => {
    // A code added by a future Better Auth release must produce a documented
    // problem, not an unhandled 500.
    expect(mapProfileError({ upstreamCode: 'SOMETHING_NEW', status: 404 })).toBe(
      ProfileErrors.NOT_FOUND,
    );
    expect(mapProfileError({ upstreamCode: 'SOMETHING_NEW', status: 400 })).toBe(
      ProfileErrors.INCORRECT_PASSWORD,
    );
    expect(mapProfileError({ upstreamCode: 'SOMETHING_NEW', status: 500 })).toBe(
      ProfileErrors.UPSTREAM_FAILURE,
    );
  });

  it('falls back on the status when there is no code at all', () => {
    expect(mapProfileError({ status: 401 })).toBe(ProfileErrors.INCORRECT_PASSWORD);
    expect(mapProfileError({ status: 502 })).toBe(ProfileErrors.UPSTREAM_FAILURE);
  });
});
