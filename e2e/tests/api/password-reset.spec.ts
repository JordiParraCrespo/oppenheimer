import { expect, test } from '@playwright/test';
import {
  changePassword,
  newContext,
  newUser,
  requestPasswordReset,
  resetPassword,
  signedUpContext,
  signIn,
  signOut,
  signUp,
} from '../../support/auth';
import {
  expireResetToken,
  findPasswordHash,
  findResetToken,
  findSessionsForUser,
} from '../../support/db';
import { emailWasSent, waitForEmailUrl } from '../../support/mail';

const NEW_PASSWORD = 'Rotated!Password9';

test.describe('password reset', () => {
  test('the full flow: request, follow the link, sign in with the new password', async () => {
    const api = await newContext();
    const user = newUser('reset');
    await signUp(api, user);
    await signOut(api);
    const beforeHash = await findPasswordHash((await findResetTokenOwner(user.email)) ?? '');

    const requested = await requestPasswordReset(api, user.email);
    expect(requested.status()).toBe(200);

    const emailUrl = await waitForEmailUrl('PASSWORD RESET', user.email);
    expect(emailUrl, 'the email carries a reset link back to the app').toContain(
      '/api/auth/reset-password/',
    );

    const token = await findResetToken(user.email);
    expect(token, 'a reset token is stored for the user').toBeTruthy();

    const reset = await resetPassword(api, token as string, NEW_PASSWORD);
    expect(reset.status()).toBe(200);

    const withNew = await newContext();
    expect(
      (await signIn(withNew, user.email, NEW_PASSWORD)).status(),
      'the new password works',
    ).toBe(200);

    const withOld = await newContext();
    expect(
      (await signIn(withOld, user.email, user.password)).status(),
      'the old password is dead',
    ).toBeGreaterThanOrEqual(400);

    const afterHash = await findPasswordHash((await findResetTokenOwner(user.email)) ?? '');
    expect(afterHash, 'the stored credential actually changed').not.toBe(beforeHash);
  });

  test('the reset link in the email redirects to the app with the token', async () => {
    const api = await newContext();
    const user = newUser('resetlink');
    await signUp(api, user);
    await requestPasswordReset(api, user.email);

    const emailUrl = await waitForEmailUrl('PASSWORD RESET', user.email);
    const follow = await api.get(emailUrl, {
      maxRedirects: 0,
      failOnStatusCode: false,
    });

    expect(follow.status(), 'the link is a redirect into the web app').toBeGreaterThanOrEqual(300);
    expect(follow.status()).toBeLessThan(400);
    const location = follow.headers().location ?? '';
    expect(location).toContain('/reset-password');
    expect(location, 'the redirect carries the token the form needs').toContain('token=');
  });

  test('a reset token is single-use', async () => {
    const api = await newContext();
    const user = newUser('reuse');
    await signUp(api, user);
    await requestPasswordReset(api, user.email);
    const token = (await findResetToken(user.email)) as string;

    expect((await resetPassword(api, token, NEW_PASSWORD)).status()).toBe(200);

    const replay = await resetPassword(api, token, 'YetAnother!Pass1');
    expect(replay.status(), 'replaying a consumed token must fail').toBeGreaterThanOrEqual(400);

    // And the replay must not have changed anything.
    const check = await newContext();
    expect((await signIn(check, user.email, NEW_PASSWORD)).status()).toBe(200);
  });

  test('an expired token is refused', async () => {
    const api = await newContext();
    const user = newUser('expired');
    await signUp(api, user);
    await requestPasswordReset(api, user.email);
    const token = (await findResetToken(user.email)) as string;
    await expireResetToken(token);

    const response = await resetPassword(api, token, NEW_PASSWORD);

    expect(response.status()).toBeGreaterThanOrEqual(400);
    const check = await newContext();
    expect(
      (await signIn(check, user.email, user.password)).status(),
      'an expired token leaves the old password in place',
    ).toBe(200);
  });

  test('a forged token is refused', async () => {
    const api = await newContext();
    const user = newUser('forged');
    await signUp(api, user);

    const response = await resetPassword(api, 'this-token-was-never-issued', NEW_PASSWORD);

    expect(response.status()).toBeGreaterThanOrEqual(400);
    const check = await newContext();
    expect((await signIn(check, user.email, user.password)).status()).toBe(200);
  });

  test("one user's token cannot reset another user's password", async () => {
    const victim = await newContext();
    const victimUser = newUser('victim');
    await signUp(victim, victimUser);

    const attacker = await newContext();
    const attackerUser = newUser('attacker');
    await signUp(attacker, attackerUser);
    await requestPasswordReset(attacker, attackerUser.email);
    const attackerToken = (await findResetToken(attackerUser.email)) as string;

    await resetPassword(attacker, attackerToken, NEW_PASSWORD);

    const check = await newContext();
    expect(
      (await signIn(check, victimUser.email, victimUser.password)).status(),
      "the victim's password is untouched",
    ).toBe(200);
    const stillNot = await newContext();
    expect(
      (await signIn(stillNot, victimUser.email, NEW_PASSWORD)).status(),
    ).toBeGreaterThanOrEqual(400);
  });

  test('a reset does not accept a password below the minimum length', async () => {
    const api = await newContext();
    const user = newUser('resetweak');
    await signUp(api, user);
    await requestPasswordReset(api, user.email);
    const token = (await findResetToken(user.email)) as string;

    const response = await resetPassword(api, token, 'short');

    expect(response.status()).toBeGreaterThanOrEqual(400);
    const check = await newContext();
    expect((await signIn(check, user.email, user.password)).status()).toBe(200);
  });

  test('requesting a reset for an unknown email neither errors nor sends mail', async () => {
    const api = await newContext();
    const ghost = `ghost-${Date.now().toString(36)}@e2e.oppenheimer.test`;

    const response = await requestPasswordReset(api, ghost);

    expect(
      response.status(),
      'the response must not tell an attacker whether the account exists',
    ).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    expect(await emailWasSent('PASSWORD RESET', ghost)).toBe(false);
  });

  test('requesting a reset twice invalidates nothing the user still needs', async () => {
    const api = await newContext();
    const user = newUser('tworesets');
    await signUp(api, user);

    await requestPasswordReset(api, user.email);
    const first = (await findResetToken(user.email)) as string;
    await requestPasswordReset(api, user.email);
    const second = (await findResetToken(user.email)) as string;

    expect(second).not.toBe(first);
    const reset = await resetPassword(api, second, NEW_PASSWORD);
    expect(reset.status(), 'the newest link always works').toBe(200);
  });
});

test.describe('change password', () => {
  test('an authenticated user can change their own password', async () => {
    const { api, user } = await signedUpContext('changepw');

    const response = await changePassword(api, user.password, NEW_PASSWORD);
    expect(response.status()).toBe(200);

    const check = await newContext();
    expect((await signIn(check, user.email, NEW_PASSWORD)).status()).toBe(200);
    const old = await newContext();
    expect((await signIn(old, user.email, user.password)).status()).toBeGreaterThanOrEqual(400);
  });

  test('the wrong current password is refused', async () => {
    const { api, user } = await signedUpContext('changepwbad');

    const response = await changePassword(api, 'NotMyPassword1!', NEW_PASSWORD);

    expect(response.status()).toBeGreaterThanOrEqual(400);
    const check = await newContext();
    expect((await signIn(check, user.email, user.password)).status()).toBe(200);
  });

  test('an unauthenticated caller cannot change a password', async () => {
    const api = await newContext();

    const response = await changePassword(api, 'whatever', NEW_PASSWORD);

    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('revokeOtherSessions logs the other devices out', async () => {
    const { api, user, userId } = await signedUpContext('revokeother');
    const other = await newContext();
    await signIn(other, user.email, user.password);
    expect((await findSessionsForUser(userId)).length).toBeGreaterThanOrEqual(2);

    const response = await changePassword(api, user.password, NEW_PASSWORD, true);
    expect(response.status()).toBe(200);

    expect((await other.get('/api/v1/users/me', { failOnStatusCode: false })).status()).toBe(401);
  });
});

/** Helper: the user id behind an email, used for password-hash comparisons. */
async function findResetTokenOwner(email: string): Promise<string | undefined> {
  const { findUserByEmail } = await import('../../support/db');
  return (await findUserByEmail(email))?.id;
}
