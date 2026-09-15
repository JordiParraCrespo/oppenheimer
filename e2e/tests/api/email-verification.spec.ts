import { expect, test } from '@playwright/test';
import { newContext, newUser, signUp } from '../../support/auth';
import { findUserByEmail } from '../../support/db';
import { waitForEmailUrl } from '../../support/mail';

test.describe('email verification', () => {
  test('following the emailed link marks the address verified', async () => {
    const api = await newContext();
    const user = newUser('verify');
    await signUp(api, user);
    expect((await findUserByEmail(user.email))?.emailVerified).toBe(false);

    const url = await waitForEmailUrl('EMAIL VERIFICATION', user.email);
    const response = await api.get(url, {
      maxRedirects: 0,
      failOnStatusCode: false,
    });

    expect(response.status(), 'verification redirects back to the app').toBeLessThan(400);
    await expect
      .poll(async () => (await findUserByEmail(user.email))?.emailVerified, {
        timeout: 10_000,
      })
      .toBe(true);
  });

  test('a forged verification token is refused', async () => {
    const api = await newContext();
    const user = newUser('verifyforge');
    await signUp(api, user);

    const response = await api.get('/api/auth/verify-email?token=made.up.token', {
      maxRedirects: 0,
      failOnStatusCode: false,
    });

    const location = response.headers().location ?? '';
    const failed = response.status() >= 400 || location.includes('error');
    expect(failed, 'an unsigned token must not verify anyone').toBe(true);
    expect((await findUserByEmail(user.email))?.emailVerified).toBe(false);
  });

  test('sign-in is allowed before verification (requireEmailVerification is off)', async () => {
    const api = await newContext();
    const user = newUser('unverified');
    await signUp(api, user);

    const response = await api.post('/api/auth/sign-in/email', {
      data: { email: user.email, password: user.password },
      failOnStatusCode: false,
    });

    // Documents the deployment's deliberate choice, so flipping the flag
    // without updating the product's expectations shows up here.
    expect(response.status()).toBe(200);
    expect((await findUserByEmail(user.email))?.emailVerified).toBe(false);
  });

  test('verification can be requested again', async () => {
    const api = await newContext();
    const user = newUser('reverify');
    await signUp(api, user);
    await waitForEmailUrl('EMAIL VERIFICATION', user.email);

    const response = await api.post('/api/auth/send-verification-email', {
      data: { email: user.email, callbackURL: '/' },
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(200);
  });
});
