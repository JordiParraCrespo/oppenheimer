import { describe, expect, it, vi } from 'vitest';
import {
  codeOwnerOfVerification,
  type GrantOwnerLookups,
  grantStepOf,
  refuseUngrantable,
} from '../infrastructure/oauth-grant-gate.util';

/**
 * Which OAuth (MCP) steps need a verified email and a sign-in newer than the
 * last password reset, and what the gate answers. The authorization-code path
 * end to end, through the real plugin, is in `api-tokens.integration.spec.ts`;
 * these cover the steps and the bodies it does not drive.
 */
describe('the OAuth grant gate', () => {
  const signedInAt = new Date('2026-11-01T00:00:00.000Z');
  const lookups = (
    emailVerified: boolean | null,
    cutoff: Date | null = null,
  ): GrantOwnerLookups => ({
    sessionUserId: vi.fn().mockResolvedValue('user-1'),
    codeOwner: vi.fn().mockResolvedValue({ userId: 'user-1', authorizedAt: signedInAt }),
    refreshTokenOwner: vi.fn().mockResolvedValue({ userId: 'user-1', authorizedAt: signedInAt }),
    emailVerified: vi.fn().mockResolvedValue(emailVerified),
    credentialCutoff: vi.fn().mockResolvedValue(cutoff),
  });

  const delivers = { emailDelivery: true };
  const doesNotDeliver = { emailDelivery: false };

  it('gates an accepted consent, and lets a refusal through', () => {
    expect(grantStepOf('/oauth2/consent', { accept: true })).toEqual({ by: 'session' });
    expect(grantStepOf('/oauth2/consent', { accept: false })).toBeNull();
  });

  it('reads the token endpoint’s form body as well as JSON', () => {
    const form = new FormData();
    form.set('grant_type', 'refresh_token');
    form.set('refresh_token', 'r-1');

    expect(grantStepOf('/mcp/token', form)).toEqual({ by: 'refresh-token', refreshToken: 'r-1' });
    expect(grantStepOf('/mcp/token', { grant_type: 'authorization_code', code: 'c-1' })).toEqual({
      by: 'authorization-code',
      code: 'c-1',
    });
    expect(grantStepOf('/sign-in/email', { accept: true })).toBeNull();
  });

  // Better Auth's token endpoint takes any JSON value and calls `toString()`
  // on it. Regression: `"code": ["…"]` skipped a `typeof === 'string'` gate
  // and was still redeemed, so an unverified account got its grant.
  it.each([
    ['an array code', { grant_type: 'authorization_code', code: ['c-1'] }],
    ['a numeric code', { grant_type: 'authorization_code', code: 123 }],
    ['an object code', { grant_type: 'authorization_code', code: { toString: () => 'c-1' } }],
    ['no code', { grant_type: 'authorization_code' }],
    ['a code under a grant type the plugin reads as one', { grant_type: ['x'], code: 7 }],
    ['an array refresh token', { grant_type: 'refresh_token', refresh_token: ['r-1'] }],
    ['a numeric refresh token', { grant_type: 'refresh_token', refresh_token: 42 }],
    ['a body that is not an object', ['authorization_code']],
  ])('refuses %s outright instead of letting it be stringified', (_case, body) => {
    expect(() => grantStepOf('/mcp/token', body)).toThrow(
      expect.objectContaining({ body: expect.objectContaining({ error: 'invalid_request' }) }),
    );
  });

  it('refuses to renew a grant for an account that has not verified its email', async () => {
    await expect(
      refuseUngrantable({ by: 'refresh-token', refreshToken: 'r-1' }, lookups(false), delivers),
    ).rejects.toMatchObject({ body: { code: 'TOKEN_010', error: 'access_denied' } });
  });

  it('treats an account it cannot read as unverified', async () => {
    await expect(
      refuseUngrantable({ by: 'session' }, lookups(null), delivers),
    ).rejects.toMatchObject({
      body: { code: 'TOKEN_010' },
    });
  });

  it('lets a verified account through', async () => {
    await expect(
      refuseUngrantable({ by: 'session' }, lookups(true), delivers),
    ).resolves.toBeUndefined();
  });

  // Without email delivery no address can ever be verified, and no reset
  // email can recover a squatted one. Regression: every account on such a
  // deployment was refused MCP for good.
  it('lets an unverified account through where the deployment delivers no email', async () => {
    const unverified = lookups(false);
    await expect(
      refuseUngrantable({ by: 'session' }, unverified, doesNotDeliver),
    ).resolves.toBeUndefined();
    await expect(
      refuseUngrantable({ by: 'authorization-code', code: 'c-1' }, lookups(null), doesNotDeliver),
    ).resolves.toBeUndefined();
    expect(unverified.emailVerified).not.toHaveBeenCalled();
  });

  it('still refuses a grant signed in before a reset where the deployment delivers no email', async () => {
    await expect(
      refuseUngrantable(
        { by: 'refresh-token', refreshToken: 'r-1' },
        lookups(false, new Date('2026-11-02T00:00:00.000Z')),
        doesNotDeliver,
      ),
    ).rejects.toMatchObject({ body: { error: 'invalid_grant' } });
  });

  // A reset deletes pending codes and grants in its transaction; one written
  // by a request that raced it is held here. Regression: a code issued
  // before the reset could still be exchanged for ten minutes after it.
  it('refuses a code or refresh token signed in before the last password reset', async () => {
    const reset = new Date('2026-11-02T00:00:00.000Z');

    await expect(
      refuseUngrantable({ by: 'authorization-code', code: 'c-1' }, lookups(true, reset), delivers),
    ).rejects.toMatchObject({ body: { error: 'invalid_grant' } });
    await expect(
      refuseUngrantable(
        { by: 'refresh-token', refreshToken: 'r-1' },
        lookups(true, reset),
        delivers,
      ),
    ).rejects.toMatchObject({ body: { error: 'invalid_grant' } });
    await expect(
      refuseUngrantable(
        { by: 'authorization-code', code: 'c-1' },
        lookups(true, new Date('2026-10-01T00:00:00.000Z')),
        delivers,
      ),
    ).resolves.toBeUndefined();
  });

  it('reads a code’s owner and sign-in time off the row the plugin wrote', () => {
    const authTime = signedInAt.getTime();
    expect(
      codeOwnerOfVerification({ value: JSON.stringify({ userId: 'user-1', authTime }) }),
    ).toEqual({ userId: 'user-1', authorizedAt: signedInAt });
    expect(codeOwnerOfVerification({ value: 'user-1' })).toBeNull();
  });
});
