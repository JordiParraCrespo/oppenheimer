import { expect, test } from '@playwright/test';

/**
 * A social sign-in that the API refused comes back as a redirect with
 * `?error=<code>` on it — the only channel a redirect has. These specs drive
 * that landing directly, because the half worth testing is what the app does
 * with the code, and the half that is not is Google's consent screen.
 *
 * The two codes below are the ones the auth config raises on purpose
 * (`disableImplicitSignUp` and `requireLocalEmailVerified` in
 * `apps/api/src/auth/auth.ts`); both used to leave the reader on a screen that
 * said nothing.
 *
 * Nothing here asserts the provider buttons themselves: they render from the
 * deployment's capability read, so a stack without `GOOGLE_CLIENT_ID` — which
 * is most of them — would fail a test that has nothing to do with credentials.
 */

test('a Google account with no user here is sent to register, not left on login', async ({
  page,
}) => {
  await page.goto('/login?error=signup_disabled');

  // The redirect is the behaviour: the login screen cannot create an account,
  // so it must not be where a person who needs one ends up.
  await expect(page).toHaveURL(/\/register/);
  await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible();
  await expect(page.getByText(/no account here for that sign-in yet/i)).toBeVisible();
});

test('an address that already has a password is told to use it', async ({ page }) => {
  await page.goto('/login?error=account_not_linked');

  // No redirect here: the password field they need is on this screen.
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(/already has an account with a password/i)).toBeVisible();
});

test('an unrecognised failure still says something', async ({ page }) => {
  await page.goto('/login?error=invalid_code');

  await expect(page.getByText(/sign-in didn't complete/i)).toBeVisible();
});
