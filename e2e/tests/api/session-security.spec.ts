import { expect, test } from '@playwright/test';
import { API_URL } from '../../playwright.config';
import {
  newContext,
  newUser,
  requestPasswordReset,
  resetPassword,
  signedUpContext,
  signIn,
  signUp,
} from '../../support/auth';
import { findResetToken, findSessionsForUser } from '../../support/db';

test.describe('session security', () => {
  // The reset is the remedy for a session someone else is holding, so it has to
  // end that session — `revokeSessionsOnPasswordReset` in `auth.ts`.
  test('a session opened before the reset no longer authenticates', async () => {
    const { api, user, userId } = await signedUpContext('stolensession');
    expect((await api.get('/api/v1/users/me', { failOnStatusCode: false })).status()).toBe(200);

    const elsewhere = await newContext();
    await requestPasswordReset(elsewhere, user.email);
    const token = (await findResetToken(user.email)) as string;
    expect((await resetPassword(elsewhere, token, 'Rotated!Password9')).status()).toBe(200);

    expect(await findSessionsForUser(userId)).toHaveLength(0);
    expect((await api.get('/api/v1/users/me', { failOnStatusCode: false })).status()).toBe(401);
  });

  test('a tampered session cookie is refused', async () => {
    const { api } = await signedUpContext('tamper');
    const state = await api.storageState();
    const cookie = state.cookies.find((c) => c.name.includes('session_token'));
    const tampered = await newContext();
    await tampered.storageState();

    const response = await tampered.get('/api/v1/users/me', {
      headers: { cookie: `${cookie?.name}=${cookie?.value?.slice(0, -4)}XXXX` },
      failOnStatusCode: false,
    });

    expect(response.status(), 'the session token is signed; a flipped byte must not pass').toBe(
      401,
    );
  });

  test('a session belonging to a deleted user stops working', async () => {
    const { api, userId } = await signedUpContext('deleted');
    const { query } = await import('../../support/db');

    await query('DELETE FROM "session" WHERE "userId" = $1', [userId]);

    expect((await api.get('/api/v1/users/me', { failOnStatusCode: false })).status()).toBe(401);
  });

  test('repeated wrong passwords never leak a session', async () => {
    const api = await newContext();
    const user = newUser('bruteforce');
    await signUp(api, user);
    const attacker = await newContext();

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await signIn(attacker, user.email, `WrongGuess${attempt}!`);
      statuses.push(response.status());
    }

    expect(
      statuses.every((status) => status >= 400),
      'not one of the guesses may succeed',
    ).toBe(true);
    expect(
      (await attacker.get('/api/v1/users/me', { failOnStatusCode: false })).status(),
      'the attacker context is still anonymous',
    ).toBe(401);
  });

  test('the API throttles a flood of requests @ratelimit', async () => {
    const api = await newContext();

    const statuses = await Promise.all(
      Array.from({ length: 140 }, () =>
        api
          .get('/api/v1/health', { failOnStatusCode: false })
          .then((response) => response.status()),
      ),
    );

    // The global ThrottlerModule allows 100 requests per minute per IP.
    expect(
      statuses.some((status) => status === 429),
      'a global rate limit is configured, so a flood must eventually be refused',
    ).toBe(true);
  });

  test('a session cookie is not readable by scripts', async () => {
    const { api } = await signedUpContext('httponly');
    const cookie = (await api.storageState()).cookies.find((c) => c.name.includes('session_token'));

    expect(cookie?.httpOnly).toBe(true);
  });

  test('security headers are present on API responses', async () => {
    const api = await newContext();

    const response = await api.get('/api/v1/health', {
      failOnStatusCode: false,
    });
    const headers = response.headers();

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['strict-transport-security']).toBeTruthy();
    expect(headers['x-frame-options'] ?? headers['content-security-policy']).toBeTruthy();
  });

  test('CORS does not open the API to an arbitrary origin', async () => {
    const { request } = await import('@playwright/test');
    // Its own context rather than `newContext()`, because the whole point is to
    // present an untrusted `Origin` — but still the configured API, so an
    // `API_URL` override tests the deployment the rest of the suite tests.
    const evil = await request.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: { Origin: 'http://evil.example.com' },
    });

    const response = await evil.get('/api/v1/health', {
      failOnStatusCode: false,
    });

    expect(
      response.headers()['access-control-allow-origin'],
      'a credentialed API must not echo back an untrusted origin',
    ).not.toBe('http://evil.example.com');
  });
});
