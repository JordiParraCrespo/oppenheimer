import { expect, test } from '@playwright/test';
import {
  getSession,
  newContext,
  newUser,
  signedUpContext,
  signIn,
  signOut,
  signUp,
  VALID_PASSWORD,
} from '../../support/auth';
import { findSessionsForUser } from '../../support/db';

test.describe('sign-in', () => {
  test('accepts the right credentials and issues a session', async () => {
    const api = await newContext();
    const user = newUser('signin');
    await signUp(api, user);
    await signOut(api);

    const response = await signIn(api, user.email, user.password);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.user.email).toBe(user.email);

    const session = await getSession(api);
    expect(session.status()).toBe(200);
    expect((await session.json())?.user?.email).toBe(user.email);
  });

  test('rejects a wrong password', async () => {
    const api = await newContext();
    const user = newUser('badpass');
    await signUp(api, user);
    await signOut(api);

    const response = await signIn(api, user.email, 'CompletelyWrong123!');

    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
    const session = await getSession(api);
    expect(await session.text(), 'a failed sign-in must not leave a session').not.toContain(
      user.email,
    );
  });

  test('rejects an unknown email without revealing that it is unknown', async () => {
    const api = await newContext();
    const known = newUser('enum');
    await signUp(api, known);
    await signOut(api);

    const unknown = await signIn(api, 'nobody-at-all@e2e.oppenheimer.test', VALID_PASSWORD);
    const wrongPassword = await signIn(api, known.email, 'WrongPassword123!');

    expect(unknown.status()).toBeGreaterThanOrEqual(400);
    expect(wrongPassword.status()).toBeGreaterThanOrEqual(400);
    expect(
      unknown.status(),
      'differing status codes let an attacker enumerate registered emails',
    ).toBe(wrongPassword.status());
    expect((await unknown.json()).message).toBe((await wrongPassword.json()).message);
  });

  test('signs in with a differently cased email', async () => {
    const api = await newContext();
    const user = newUser('caselogin');
    await signUp(api, user);
    await signOut(api);

    const response = await signIn(api, user.email.toUpperCase(), user.password);

    expect(response.status(), 'email is case-insensitive in practice').toBe(200);
  });

  test('rejects an empty password', async () => {
    const api = await newContext();
    const user = newUser('emptypass');
    await signUp(api, user);
    await signOut(api);

    const response = await signIn(api, user.email, '');

    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('sign-out clears the session and the row behind it', async () => {
    const { api, user, userId } = await signedUpContext('signout');
    expect(await findSessionsForUser(userId)).not.toHaveLength(0);

    const response = await signOut(api);
    expect(response.status()).toBe(200);

    const session = await getSession(api);
    const body = await session.text();
    expect(body === '' || body === 'null' || !body.includes(user.email)).toBe(true);

    await expect
      .poll(async () => (await findSessionsForUser(userId)).length, {
        timeout: 5_000,
      })
      .toBe(0);
  });

  test('a session issued before sign-out stops working after it', async () => {
    const { api, userId } = await signedUpContext('revoke');
    await signOut(api);

    const protectedRoute = await api.get('/api/v1/users/me', {
      failOnStatusCode: false,
    });

    expect(protectedRoute.status()).toBe(401);
    expect(await findSessionsForUser(userId)).toHaveLength(0);
  });

  test('signing in twice yields two independent sessions', async () => {
    const api = await newContext();
    const user = newUser('multi');
    await signUp(api, user);

    const second = await newContext();
    expect((await signIn(second, user.email, user.password)).status()).toBe(200);

    // Both contexts must still be able to read their own session.
    expect((await getSession(api)).status()).toBe(200);
    expect((await getSession(second)).status()).toBe(200);
  });
});
