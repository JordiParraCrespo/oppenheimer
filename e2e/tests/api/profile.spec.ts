import { expect, test } from '@playwright/test';
import { expectProblemDocument, newContext, newUser, signUp } from '../../support/auth';
import { findUserByEmail, query } from '../../support/db';
import { waitForEmailUrl } from '../../support/mail';
import { provisionedUser } from '../../support/web';

/**
 * Settings → Profile, through the API: the username, moving the account to
 * another address, and deleting it. What the unit tests cannot show is the
 * whole chain — Better Auth's link actually moving the account, and a
 * deleted account's cookie actually refused.
 */
const handle = (label: string) => `${label}-${Date.now().toString(36)}`;

test.describe('username', () => {
  test('is set, read back and cleared', async () => {
    const { api } = await provisionedUser('username');
    const username = handle('adri');

    const set = await api.patch('/api/v1/profile', { data: { username } });
    expect(set.status()).toBe(200);
    expect((await set.json()).username).toBe(username);
    expect((await (await api.get('/api/v1/profile')).json()).username).toBe(username);

    const cleared = await api.patch('/api/v1/profile', { data: { username: null } });
    expect((await cleared.json()).username).toBeNull();
    await api.dispose();
  });

  test('is unique across accounts', async () => {
    const first = await provisionedUser('usernameone');
    const second = await provisionedUser('usernametwo');
    const username = handle('taken');
    expect((await first.api.patch('/api/v1/profile', { data: { username } })).status()).toBe(200);

    const response = await second.api.patch('/api/v1/profile', {
      data: { username },
      failOnStatusCode: false,
    });

    await expectProblemDocument(response, { status: 409, code: 'USER_002' });
    await first.api.dispose();
    await second.api.dispose();
  });

  test('refuses a handle outside the pattern', async () => {
    const { api } = await provisionedUser('usernamebad');

    const response = await api.patch('/api/v1/profile', {
      data: { username: 'Not A Handle' },
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(400);
    await api.dispose();
  });
});

test.describe('changing the email address', () => {
  test('moves the account when the link sent to the new address is followed', async () => {
    const { api, user } = await provisionedUser('moving');
    const newEmail = newUser('moved').email;

    const response = await api.post('/api/v1/profile/email', { data: { newEmail } });
    expect(response.status()).toBe(202);
    // Nothing moves on the request alone.
    expect((await findUserByEmail(user.email))?.email).toBe(user.email.toLowerCase());

    const url = await waitForEmailUrl('EMAIL VERIFICATION', newEmail);
    expect(url).toContain('callbackURL=');
    const followed = await api.get(url, { maxRedirects: 0, failOnStatusCode: false });
    expect(followed.status()).toBeLessThan(400);

    await expect
      .poll(async () => (await findUserByEmail(newEmail))?.emailVerified, { timeout: 10_000 })
      .toBe(true);
    expect(await findUserByEmail(user.email)).toBeUndefined();
    await api.dispose();
  });

  test('refuses the address the account already uses', async () => {
    const { api, user } = await provisionedUser('sameemail');

    const response = await api.post('/api/v1/profile/email', {
      data: { newEmail: user.email.toUpperCase() },
      failOnStatusCode: false,
    });

    await expectProblemDocument(response, { status: 400, code: 'PROFILE_009' });
    await api.dispose();
  });
});

test.describe('deleting the account', () => {
  test('refuses a confirmation that is not the email, and deletes nothing', async () => {
    const { api, user } = await provisionedUser('keepme');

    const response = await api.delete('/api/v1/profile', {
      data: { confirmation: 'not-my-email@example.com' },
      failOnStatusCode: false,
    });

    await expectProblemDocument(response, { status: 400, code: 'PROFILE_010' });
    expect(await findUserByEmail(user.email)).toBeDefined();
    await api.dispose();
  });

  test('removes the account, its workspace and its sign-ins', async () => {
    const { api, user, userId, organizationId } = await provisionedUser('deleteme');

    const response = await api.delete('/api/v1/profile', { data: { confirmation: user.email } });
    expect(response.status()).toBe(204);

    expect(await findUserByEmail(user.email)).toBeUndefined();
    expect(await query('SELECT 1 FROM "organization" WHERE "id" = $1', [organizationId])).toEqual(
      [],
    );
    expect(await query('SELECT 1 FROM "session" WHERE "userId" = $1', [userId])).toEqual([]);
    // The cookie the browser still holds names a session that is gone.
    expect((await api.get('/api/v1/profile', { failOnStatusCode: false })).status()).toBe(401);

    // And the address is free to sign up with again.
    const again = await newContext();
    expect((await signUp(again, { ...user })).status()).toBe(200);
    await again.dispose();
    await api.dispose();
  });
});
