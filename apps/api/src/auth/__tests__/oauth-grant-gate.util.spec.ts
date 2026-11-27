import { describe, expect, it, vi } from 'vitest';
import {
  type GrantOwnerLookups,
  grantStepOf,
  refuseUnverifiedGrant,
} from '../infrastructure/oauth-grant-gate.util';

/**
 * Which OAuth (MCP) steps need a verified email, and what the gate answers.
 * The authorization-code path end to end, through the real plugin, is in
 * `api-tokens.integration.spec.ts`; these cover the steps it does not drive.
 */
describe('the OAuth grant gate', () => {
  const lookups = (emailVerified: boolean | null): GrantOwnerLookups => ({
    sessionUserId: vi.fn().mockResolvedValue('user-1'),
    codeUserId: vi.fn().mockResolvedValue('user-1'),
    refreshTokenUserId: vi.fn().mockResolvedValue('user-1'),
    emailVerified: vi.fn().mockResolvedValue(emailVerified),
  });

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

  it('refuses to renew a grant for an account that has not verified its email', async () => {
    await expect(
      refuseUnverifiedGrant({ by: 'refresh-token', refreshToken: 'r-1' }, lookups(false)),
    ).rejects.toMatchObject({ body: { code: 'TOKEN_010', error: 'access_denied' } });
  });

  it('treats an account it cannot read as unverified', async () => {
    await expect(refuseUnverifiedGrant({ by: 'session' }, lookups(null))).rejects.toMatchObject({
      body: { code: 'TOKEN_010' },
    });
  });

  it('lets a verified account through', async () => {
    await expect(refuseUnverifiedGrant({ by: 'session' }, lookups(true))).resolves.toBeUndefined();
  });
});
