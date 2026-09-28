import { createHmac } from 'node:crypto';
import { APIError } from 'better-auth/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'unit-test-secret-value-32-characters';
const COOKIE = 'better-auth.session_token';
const getSession = vi.fn();

vi.mock('../infrastructure/better-auth.config', () => ({
  auth: {
    api: { getSession: (...args: unknown[]) => getSession(...args) },
    get $context() {
      return Promise.resolve({
        secret: SECRET,
        authCookies: { sessionToken: { name: COOKIE } },
      });
    },
  },
}));

import { BetterAuthCredentialVerifierAdapter } from '../infrastructure/better-auth-credential-verifier.adapter';

/** A cookie value exactly as Better Auth sets it (better-call's `signCookieValue`). */
function signed(token: string, secret = SECRET): string {
  const signature = createHmac('sha256', secret).update(token).digest('base64');
  return encodeURIComponent(`${token}.${signature}`);
}

describe('BetterAuthCredentialVerifierAdapter', () => {
  const verifier = new BetterAuthCredentialVerifierAdapter();

  beforeEach(() => vi.clearAllMocks());

  describe('signedSessionCookie', () => {
    it('answers the token of a cookie Better Auth signed, without a lookup', async () => {
      const token = await verifier.signedSessionCookie({
        cookie: `theme=dark; ${COOKIE}=${signed('real-token')}`,
      });

      expect(token).toBe('real-token');
      expect(getSession).not.toHaveBeenCalled();
    });

    it('refuses a cookie signed with another secret', async () => {
      await expect(
        verifier.signedSessionCookie({ cookie: `${COOKIE}=${signed('real-token', 'other')}` }),
      ).resolves.toBeNull();
    });

    it('refuses an unsigned or tampered cookie', async () => {
      const valid = decodeURIComponent(signed('real-token'));
      const tampered = encodeURIComponent(valid.replace('real-token', 'fake-token'));

      await expect(verifier.signedSessionCookie({ cookie: `${COOKIE}=bare` })).resolves.toBeNull();
      await expect(
        verifier.signedSessionCookie({ cookie: `${COOKIE}=${tampered}` }),
      ).resolves.toBeNull();
    });

    it('has nothing to say without the session cookie', async () => {
      await expect(verifier.signedSessionCookie({})).resolves.toBeNull();
      await expect(verifier.signedSessionCookie({ cookie: 'theme=dark' })).resolves.toBeNull();
    });
  });

  describe('verifySession', () => {
    it('hands back the session and its user', async () => {
      const found = { session: { id: 's1', userId: 'u1' }, user: { id: 'u1' } };
      getSession.mockResolvedValue(found);

      await expect(verifier.verifySession({ cookie: 'x' })).resolves.toBe(found);
    });

    it('answers no session for a credential Better Auth refuses', async () => {
      getSession.mockRejectedValue(new APIError('UNAUTHORIZED'));

      await expect(verifier.verifySession({ cookie: 'x' })).resolves.toBeNull();
    });

    it('propagates a failure of Better Auth itself: an outage is not a verdict', async () => {
      getSession.mockRejectedValue(new Error('connection refused'));

      await expect(verifier.verifySession({ cookie: 'x' })).rejects.toThrow('connection refused');
    });
  });
});
