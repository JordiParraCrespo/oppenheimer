import { expect, test } from '@playwright/test';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Settings, in a browser: its own chrome beside the console
 * (`design/version1/Settings.dc.html`). What this holds is the router setup
 * — the account menu's link, the sections and their URLs, the way back —
 * rather than any section's rows, which arrive with their slices.
 */
test('settings opens from the account menu, walks its sections and comes back', async ({
  page,
}) => {
  const owner = await provisionedUser('settings');
  await signInAs(page, owner.user);
  await page.goto('/sessions');

  await page
    .getByRole('button', { name: `${owner.user.firstName} ${owner.user.lastName}` })
    .click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();

  // `/settings` is no page of its own: it lands on Profile.
  await expect(page).toHaveURL(/\/settings\/profile$/);
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect(page.getByText(owner.user.email)).toBeVisible();
  // The console's chrome is not here.
  await expect(page.getByRole('link', { name: 'New session', exact: true })).toHaveCount(0);

  await page.getByRole('link', { name: 'Hosts' }).click();
  await expect(page).toHaveURL(/\/settings\/hosts$/);
  await expect(page.getByRole('heading', { name: 'Hosts' })).toBeVisible();

  // Add host opens a page inside Settings, the settings sidebar still
  // beside it: Hosts as its parent crumb, Done as its primary, Cancel back
  // to the list.
  await page.getByRole('link', { name: 'Add host' }).click();
  await expect(page).toHaveURL(/\/settings\/hosts\/new$/);
  await expect(page.getByRole('heading', { name: 'Add a host' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to console' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Done' })).toBeDisabled();
  await page.getByRole('link', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/\/settings\/hosts$/);

  await page.getByRole('link', { name: 'Back to console' }).click();
  await expect(page).toHaveURL(/\/sessions/);

  await owner.api.dispose();
});
