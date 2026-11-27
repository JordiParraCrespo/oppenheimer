import {
  type CredentialApi,
  credentialFlows,
  startCredentialApi,
  stopCredentialApi,
} from '../../auth/__tests__/credential-flows.spec-support';
import type { SessionCachePort } from '../../auth/application/session-cache.port';
import { SESSION_CACHE } from '../../auth/auth.di-tokens';

/**
 * `POST /v1/admin/users/:id/set-password` through the whole app: the facade
 * hands the account back by taking back what a password reset does, and
 * answers `ADMIN_008` when it could not. The reset's own take-back is
 * `auth/__tests__/oauth-grants.integration.spec.ts`.
 */
describe('Admin set-password (integration)', () => {
  let api: CredentialApi;
  const { call, signUp, registerOAuthClient, exchangeOAuthCode, oauthGrantCount } = credentialFlows(
    () => api,
  );

  beforeAll(async () => {
    api = await startCredentialApi();
  }, 180000);

  afterAll(() => stopCredentialApi(api));

  // An administrator setting a password is how an account is handed back to
  // the person it belongs to. Regression: Better Auth's `setUserPassword`
  // only rewrote the hash, so the previous holder's token, grant and session
  // all kept working.
  describe("an administrator's set-password", () => {
    async function signUpAdmin(email: string) {
      const admin = await signUp(email);
      await api.dataSource.query(`UPDATE "user" SET "role" = 'admin' WHERE "id" = $1`, [admin.id]);
      await api.app.get<SessionCachePort>(SESSION_CACHE).refreshUser(admin.id);
      return admin;
    }

    it('takes back what a reset does: the cutoff, the tokens, the grants and the sessions', async () => {
      const owner = await signUp('handed-back@example.com');
      const minted = await call('/api/v1/tokens', {
        method: 'POST',
        token: owner.sessionToken,
        body: { name: 'before the hand-back', scopes: ['tokens:read'] },
      });
      expect(minted.status).toBe(201);
      const pat = (minted.body as { token: string }).token;
      const granted = await exchangeOAuthCode(owner.sessionToken, await registerOAuthClient());
      expect(granted.status).toBe(200);
      const admin = await signUpAdmin('hands-back@example.com');

      const set = await call(`/api/v1/admin/users/${owner.id}/set-password`, {
        method: 'POST',
        token: admin.sessionToken,
        body: { newPassword: 'Handed-back-password-1' },
      });

      expect(set.status, JSON.stringify(set.body)).toBe(201);
      const cutoff: { n: number }[] = await api.dataSource.query(
        'SELECT count(*)::int AS n FROM "credential_cutoff" WHERE "userId" = $1',
        [owner.id],
      );
      expect(cutoff[0].n).toBe(1);
      expect((await call('/api/v1/me/credential', { token: pat })).status).toBe(401);
      expect(
        (await call('/api/v1/me/credential', { token: granted.body?.access_token as string }))
          .status,
      ).toBe(401);
      expect(await oauthGrantCount(owner.id)).toBe(0);
      expect((await call('/api/v1/users/me', { token: owner.sessionToken })).status).toBe(401);
      const sessions: { n: number }[] = await api.dataSource.query(
        'SELECT count(*)::int AS n FROM "session" WHERE "userId" = $1',
        [owner.id],
      );
      expect(sessions[0].n).toBe(0);
      // The administrator's own session is not the account's, and stays.
      expect((await call('/api/v1/users/me', { token: admin.sessionToken })).status).toBe(200);
    });

    it('answers an error when the credentials could not be taken back, and leaves the token for a retry', async () => {
      const owner = await signUp('handed-back-failed@example.com');
      const minted = await call('/api/v1/tokens', {
        method: 'POST',
        token: owner.sessionToken,
        body: { name: 'survives a failed hand-back', scopes: ['tokens:read'] },
      });
      const pat = (minted.body as { token: string }).token;
      const admin = await signUpAdmin('hands-back-failed@example.com');
      const { CompletePasswordResetCommandHandler } = await import(
        '../../auth/commands/complete-password-reset/complete-password-reset.command-handler'
      );
      const execute = vi
        .spyOn(api.app.get(CompletePasswordResetCommandHandler), 'execute')
        .mockRejectedValueOnce(new Error('the reset transaction failed'));
      const setPassword = () =>
        call(`/api/v1/admin/users/${owner.id}/set-password`, {
          method: 'POST',
          token: admin.sessionToken,
          body: { newPassword: 'Handed-back-password-2' },
        });

      const failed = await setPassword();

      expect(failed.status).toBe(502);
      expect(failed.body?.code).toBe('ADMIN_008');
      execute.mockRestore();
      expect((await call('/api/v1/me/credential', { token: pat })).status).toBe(200);
      expect((await setPassword()).status).toBe(201);
      expect((await call('/api/v1/me/credential', { token: pat })).status).toBe(401);
    });
  });
});
