import { expect, test } from '@playwright/test';
import { expectProblemDocument, newContext, signedUpContext, signOut } from '../../support/auth';
import { setUserRole } from '../../support/db';

test.describe('protected routes', () => {
  test('an authenticated user can read their own profile', async () => {
    const { api, user, userId } = await signedUpContext('me');

    const response = await api.get('/api/v1/users/me', {
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ id: userId, email: user.email });
    expect(body.password, 'a profile response must never carry a credential').toBeUndefined();
  });

  test('an anonymous caller gets an RFC 7807 401', async () => {
    const api = await newContext();

    const response = await api.get('/api/v1/users/me', {
      failOnStatusCode: false,
    });

    await expectProblemDocument(response, { status: 401, code: 'AUTH_001' });
  });

  test('a garbage bearer token is refused', async () => {
    const api = await newContext();

    const response = await api.get('/api/v1/users/me', {
      headers: { authorization: 'Bearer not-a-real-token' },
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(401);
  });

  test('a session token works as a bearer credential', async () => {
    const { api, user } = await signedUpContext('bearer');
    const cookie = (await api.storageState()).cookies.find((c) => c.name.includes('session_token'));
    const token = decodeURIComponent(cookie?.value ?? '');

    const clean = await newContext();
    const response = await clean.get('/api/v1/users/me', {
      headers: { authorization: `Bearer ${token}` },
      failOnStatusCode: false,
    });

    expect(response.status(), 'the bearer plugin accepts a session token').toBe(200);
    expect((await response.json()).email).toBe(user.email);
  });

  test('an admin can list users', async () => {
    const { api, userId } = await signedUpContext('admin');
    await setUserRole(userId, 'admin');

    const response = await api.get('/api/v1/users', {
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(200);
  });

  test('an ordinary user cannot delete another user', async () => {
    const { userId: victimId } = await signedUpContext('victimdel');
    const { api } = await signedUpContext('nosydeleter');

    const response = await api.delete(`/api/v1/users/${victimId}`, {
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(403);
  });

  test('sign-out revokes access to protected routes', async () => {
    const { api } = await signedUpContext('logoutprotect');
    expect((await api.get('/api/v1/users/me', { failOnStatusCode: false })).status()).toBe(200);

    await signOut(api);

    expect((await api.get('/api/v1/users/me', { failOnStatusCode: false })).status()).toBe(401);
  });

  test('health is public and reports capabilities', async () => {
    const api = await newContext();

    const health = await api.get('/api/v1/health', { failOnStatusCode: false });
    const capabilities = await api.get('/api/v1/health/capabilities', {
      failOnStatusCode: false,
    });

    expect(health.status()).toBe(200);
    expect(capabilities.status()).toBe(200);
    const body = await capabilities.json();
    expect(body, 'capabilities tell a client which sign-in methods exist').toBeTruthy();
  });
});
