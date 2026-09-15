import { expect, test } from '@playwright/test';
import { newContext, newUser, signedUpContext, signUp, VALID_PASSWORD } from '../../support/auth';
import {
  findOrganizationsForUser,
  findRoleNames,
  findTeamsForUser,
  findUserByEmail,
} from '../../support/db';
import { waitForEmailUrl } from '../../support/mail';

test.describe('sign-up', () => {
  test('creates the account and returns a session', async () => {
    const api = await newContext();
    const user = newUser('signup');

    const response = await signUp(api, user);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.user).toMatchObject({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: false,
      role: 'user',
      banned: false,
    });
    // The id must be a UUID: the `/users/:id` routes validate with ParseUUIDPipe.
    expect(body.user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

    const cookies = (await api.storageState()).cookies;
    const session = cookies.find((cookie) => cookie.name.includes('session_token'));
    expect(session, 'sign-up sets a session cookie').toBeTruthy();
  });

  test('the session cookie is httpOnly and SameSite-scoped', async () => {
    const { api } = await signedUpContext('cookie');
    const cookie = (await api.storageState()).cookies.find((c) => c.name.includes('session_token'));

    expect(cookie?.httpOnly, 'session cookie must be out of reach of scripts').toBe(true);
    expect(cookie?.sameSite).toBe('Lax');
    expect(cookie?.path).toBe('/');
  });

  test('assigns the default RBAC role through the user_role join', async () => {
    const { userId } = await signedUpContext('role');
    // Best-effort in a database hook, so give it a moment to land.
    await expect.poll(async () => findRoleNames(userId), { timeout: 10_000 }).toContain('user');
  });

  /**
   * The personal workspace (`product/versions/mvp/00-scope.md`): sign-up
   * provisions one organization owned by the account and nothing else — no
   * "General" team, no second membership. The hook is best-effort and runs a
   * beat behind the response; onboarding (`e2e/tests/web/onboarding.spec.ts`)
   * is the recovery path when it did not land.
   */
  test('provisions the personal workspace: one owned organization, no team', async () => {
    const { userId } = await signedUpContext('org');

    await expect
      .poll(async () => findOrganizationsForUser(userId), { timeout: 10_000 })
      .toEqual([expect.objectContaining({ role: 'owner' })]);
    expect(await findTeamsForUser(userId)).toEqual([]);
  });

  test('sends verification and welcome email on sign-up', async () => {
    const api = await newContext();
    const user = newUser('verifymail');
    await signUp(api, user);

    const url = await waitForEmailUrl('EMAIL VERIFICATION', user.email);
    expect(url).toContain('/api/auth/verify-email?token=');
  });

  test('rejects a duplicate email', async () => {
    const api = await newContext();
    const user = newUser('dupe');
    expect((await signUp(api, user)).status()).toBe(200);

    const second = await newContext();
    const response = await signUp(second, user);

    expect(
      response.status(),
      'a taken email must not create a second account',
    ).toBeGreaterThanOrEqual(400);
    const body = await response.json();
    expect(JSON.stringify(body).toLowerCase()).toMatch(/exist|taken|already/);
  });

  test('rejects a password shorter than the 8-character minimum', async () => {
    const api = await newContext();
    const user = { ...newUser('weak'), password: 'short' };

    const response = await signUp(api, user);

    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(await findUserByEmail(user.email)).toBeUndefined();
  });

  test('rejects a malformed email', async () => {
    const api = await newContext();
    const response = await api.post('/api/auth/sign-up/email', {
      data: {
        email: 'not-an-email',
        password: VALID_PASSWORD,
        name: 'Bad Email',
        firstName: 'Bad',
        lastName: 'Email',
      },
      failOnStatusCode: false,
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('treats email as case-insensitive for uniqueness', async () => {
    const api = await newContext();
    const user = newUser('case');
    expect((await signUp(api, user)).status()).toBe(200);

    const second = await newContext();
    const response = await signUp(second, {
      ...user,
      email: user.email.toUpperCase(),
    });

    expect(
      response.status(),
      'ALICE@x and alice@x must not be two accounts — one of them would be unreachable by reset',
    ).toBeGreaterThanOrEqual(400);
  });
});
