import { expect, test } from '@playwright/test';
import { newUser } from '../../support/auth';
import { findUserByEmail } from '../../support/db';
import { waitForEmailUrl } from '../../support/mail';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Settings → Profile, in a browser: the card's save row, the email dialog,
 * the devices list and deleting the account, against the real API.
 */
test('the profile card saves the name and the username', async ({ page }) => {
  const owner = await provisionedUser('profilecard');
  await signInAs(page, owner.user);
  await page.goto('/settings/profile');

  await expect(page.getByText(owner.user.email)).toBeVisible();
  // Nothing changed yet, so there is nothing to save.
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);

  await page.getByLabel('First name').fill('Ada');
  const username = `ada-${Date.now().toString(36)}`;
  // Typed in capitals; the schema normalises it, and the card shows what was saved.
  await page.getByLabel('Username').fill(username.toUpperCase());

  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  await expect(page.getByLabel('Username')).toHaveValue(username);

  await page.reload();
  await expect(page.getByLabel('First name')).toHaveValue('Ada');
  await expect(page.getByLabel('Username')).toHaveValue(username);

  await page.getByLabel('Last name').fill('Lovelace');
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByLabel('Last name')).toHaveValue(owner.user.lastName);

  await owner.api.dispose();
});

test('a picture is uploaded and removed', async ({ page }) => {
  const owner = await provisionedUser('profilepicture');
  await signInAs(page, owner.user);
  await page.goto('/settings/profile');
  await expect(page.getByText(owner.user.email)).toBeVisible();

  // A 1×1 PNG: the smallest file the API accepts as an image.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  await page
    .getByLabel('Profile picture')
    .setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible();

  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('button', { name: 'Remove' })).toHaveCount(0);
  await owner.api.dispose();
});

test('change email sends a link and says so', async ({ page }) => {
  const owner = await provisionedUser('profileemail');
  await signInAs(page, owner.user);
  await page.goto('/settings/profile');

  // The card loads first; until it does, the first Change is the password's.
  await expect(page.getByText(owner.user.email)).toBeVisible();
  await page.getByRole('button', { name: 'Change' }).first().click();
  const dialog = page.getByRole('dialog');
  const newEmail = newUser('moved').email;
  await dialog.getByLabel('New email').fill(newEmail);
  await dialog.getByRole('button', { name: 'Send link' }).click();
  await expect(dialog.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Done' }).click();

  // The account keeps its address until the link is followed.
  await expect(page.getByText(owner.user.email)).toBeVisible();

  // Following it lands back here, saying so, with the new address on the card.
  await page.goto(await waitForEmailUrl('EMAIL VERIFICATION', newEmail));
  await expect(page.getByText('Your email address is updated')).toBeVisible();
  await expect(page.getByText(newEmail)).toBeVisible();
  await owner.api.dispose();
});

test('changing the password keeps this device signed in', async ({ page }) => {
  const owner = await provisionedUser('profilepassword');
  await signInAs(page, owner.user);
  await page.goto('/settings/profile');
  await expect(page.getByText(owner.user.email)).toBeVisible();

  await page.getByRole('button', { name: 'Change' }).nth(1).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Current password').fill(owner.user.password);
  await dialog.getByLabel('New password', { exact: true }).fill('An0ther!Secret');
  await dialog.getByLabel('Confirm new password').fill('An0ther!Secret');
  await dialog.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByText('Password changed. Other devices are signed out.')).toBeVisible();

  // The other session (the API context) is gone; this one was reissued.
  await page.reload();
  await expect(page).toHaveURL(/\/settings\/profile/);
  await expect(page.getByText('This device')).toBeVisible();
  expect((await owner.api.get('/api/v1/profile', { failOnStatusCode: false })).status()).toBe(401);
  await owner.api.dispose();
});

test('the devices list marks this one and signs the others out', async ({ page }) => {
  const owner = await provisionedUser('profiledevices');
  await signInAs(page, owner.user);
  await page.goto('/settings/profile');

  await expect(page.getByText('This device')).toBeVisible();
  // The API context signed up too, so there is another device to sign out.
  await page.getByRole('button', { name: 'Sign out of all other devices' }).click();
  await expect(page.getByText('Your other devices are signed out.')).toBeVisible();
  await expect((await owner.api.get('/api/v1/profile', { failOnStatusCode: false })).status()).toBe(
    401,
  );
  await owner.api.dispose();
});

test('deleting the account asks for the email and ends on sign-in', async ({ page }) => {
  const owner = await provisionedUser('profiledelete');
  await signInAs(page, owner.user);
  await page.goto('/settings/profile');

  await page.getByRole('button', { name: 'Delete account' }).click();
  const dialog = page.getByRole('alertdialog');
  await dialog.getByLabel(/to confirm/).fill('someone-else@example.com');
  await dialog.getByRole('button', { name: 'Delete account' }).click();
  await expect(dialog.getByText('Type your email address exactly.')).toBeVisible();

  await dialog.getByLabel(/to confirm/).fill(owner.user.email);
  await dialog.getByRole('button', { name: 'Delete account' }).click();

  await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
  expect(await findUserByEmail(owner.user.email)).toBeUndefined();
  await owner.api.dispose();
});
