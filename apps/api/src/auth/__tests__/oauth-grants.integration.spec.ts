import {
  type CredentialApi,
  credentialFlows,
  startCredentialApi,
  stopCredentialApi,
} from './credential-flows.spec-support';

/**
 * An OAuth (MCP) grant from issue to take-back, through the whole app: the
 * token endpoint's gate (`refuseUngrantable`, whose decision table is
 * `oauth-grant-gate.util.spec.ts`) refusing an unverified account, and a
 * password reset's cutoff taking back the grants, the codes not yet exchanged
 * and the API tokens with them. What the API tokens do in the window before
 * their revocation is delivered is `api-tokens.integration.spec.ts`; an
 * administrator's set-password is `admin-set-password.integration.spec.ts`.
 */
describe('OAuth grants and the credential cutoff (integration)', () => {
  let api: CredentialApi;
  const {
    call,
    signUp,
    registerOAuthClient,
    authorizeOAuthCode,
    exchangeCode,
    exchangeOAuthCode,
    oauthGrantCount,
    resetPassword,
    attemptPasswordReset,
  } = credentialFlows(() => api);

  beforeAll(async () => {
    api = await startCredentialApi();
  }, 180000);

  afterAll(() => stopCredentialApi(api));

  // Pre-account squatting: someone registers the victim's address first and
  // issues a credential that would outlive the real owner's password reset.
  describe('an account whose email is not verified', () => {
    let squatter: { id: string; email: string; sessionToken: string };

    beforeAll(async () => {
      squatter = await signUp('squatter@example.com', { verified: false });
    });

    it('is refused an OAuth grant at the token endpoint, and no grant is stored', async () => {
      const exchanged = await exchangeOAuthCode(squatter.sessionToken, await registerOAuthClient());

      expect(exchanged.status).toBe(403);
      expect(exchanged.body?.code).toBe('TOKEN_010');
      expect(exchanged.body?.error).toBe('access_denied');
      expect(await oauthGrantCount(squatter.id)).toBe(0);
    });

    // Better Auth reads any JSON value for `code` and stringifies it.
    // Regression: `"code": ["…"]` skipped the gate and was redeemed.
    it.each([
      ['an array', (code: string) => [code]],
      ['a number', () => 12345],
    ])('is refused when the code is sent as %s, and no grant is stored', async (_shape, codeAs) => {
      const grant = await authorizeOAuthCode(squatter.sessionToken, await registerOAuthClient());

      const exchanged = await exchangeCode(grant, { codeAs });

      expect(exchanged.status).toBe(400);
      expect(exchanged.body?.error).toBe('invalid_request');
      expect(await oauthGrantCount(squatter.id)).toBe(0);
    });
  });

  describe('a password reset', () => {
    it('revokes every API token and OAuth grant the account held', async () => {
      const owner = await signUp('recovered@example.com');
      const minted = await call('/api/v1/tokens', {
        method: 'POST',
        token: owner.sessionToken,
        body: { name: 'before the reset', scopes: ['tokens:read'] },
      });
      expect(minted.status).toBe(201);
      const pat = (minted.body as { token: string }).token;

      const granted = await exchangeOAuthCode(owner.sessionToken, await registerOAuthClient());
      expect(granted.status).toBe(200);
      const accessToken = granted.body?.access_token as string;
      expect((await call('/api/v1/me/credential', { token: pat })).status).toBe(200);
      expect((await call('/api/v1/me/credential', { token: accessToken })).status).toBe(200);

      await resetPassword(owner);

      // Both go in the reset's own transaction, the token by its cutoff; the
      // outbox then marks the token revoked as well.
      expect((await call('/api/v1/me/credential', { token: accessToken })).status).toBe(401);
      const refused = await call('/api/v1/me/credential', { token: pat });
      expect(refused.status).toBe(401);
      expect(refused.body?.code).toBe('TOKEN_003');
      expect(await oauthGrantCount(owner.id)).toBe(0);
      await vi.waitFor(async () => {
        const tokens: { revokedAt: Date | null }[] = await api.dataSource.query(
          'SELECT "revokedAt" FROM "api_token" WHERE "userId" = $1',
          [owner.id],
        );
        expect(tokens.map((token) => token.revokedAt)).not.toContain(null);
      });
    });

    // Regression: the hook's dispatch swallowed the failure, so a reset whose
    // transaction threw answered 200 with no cutoff written and every token
    // alive. The next reset, from a new link, is what takes them back.
    it('answers an error when the credentials could not be revoked, and a retry revokes them', async () => {
      const owner = await signUp('failed-reset@example.com');
      const minted = await call('/api/v1/tokens', {
        method: 'POST',
        token: owner.sessionToken,
        body: { name: 'survives a failed reset', scopes: ['tokens:read'] },
      });
      expect(minted.status).toBe(201);
      const pat = (minted.body as { token: string }).token;
      const { CompletePasswordResetCommandHandler } = await import(
        '../commands/complete-password-reset/complete-password-reset.command-handler'
      );
      const execute = vi
        .spyOn(api.app.get(CompletePasswordResetCommandHandler), 'execute')
        .mockRejectedValueOnce(new Error('the reset transaction failed'));

      const failed = await attemptPasswordReset(owner);

      expect(failed.ok).toBe(false);
      expect(failed.status).toBe(500);
      expect(execute).toHaveBeenCalledTimes(1);
      execute.mockRestore();
      expect((await call('/api/v1/me/credential', { token: pat })).status).toBe(200);

      await resetPassword(owner);

      expect((await call('/api/v1/me/credential', { token: pat })).status).toBe(401);
    });

    // Regression: a code issued before the reset stayed redeemable for its
    // ten minutes, handing whoever held it a fresh grant.
    it('takes back an authorization code issued before it, unexchanged', async () => {
      const owner = await signUp('pending-code@example.com');
      const grant = await authorizeOAuthCode(owner.sessionToken, await registerOAuthClient());

      await resetPassword(owner);

      const rows: { n: number }[] = await api.dataSource.query(
        'SELECT count(*)::int AS n FROM "verification" WHERE "identifier" = $1',
        [grant.code],
      );
      expect(rows[0].n).toBe(0);
      const exchanged = await exchangeCode(grant);
      expect(exchanged.status).toBe(401);
      expect(exchanged.body?.error).toBe('invalid_grant');
      expect(await oauthGrantCount(owner.id)).toBe(0);
    });
  });
});
