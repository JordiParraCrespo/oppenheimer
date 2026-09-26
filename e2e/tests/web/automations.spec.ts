import { expect, test } from '@playwright/test';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Automations, in a browser: the router setup
 * (`product/versions/mvp/13-automations.md`) — the rail's second item, the
 * list beside it, the overview's two tabs, the editor and the way back —
 * rather than any automation, which needs the API behind it.
 */
test('the rail switches to the automations list, and its pages link up', async ({ page }) => {
  const owner = await provisionedUser('automations');
  await signInAs(page, owner.user);
  await page.goto('/sessions');

  await page.getByRole('link', { name: 'Automations', exact: true }).click();
  await expect(page).toHaveURL(/\/automations$/);
  // The sidebar is the automations list now.
  await expect(
    page.getByRole('link', { name: 'New automation', exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'New session', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Runs' }).click();
  await expect(page).toHaveURL(/\/automations\/runs$/);
  await page.getByRole('button', { name: 'Automations', exact: true }).click();
  await expect(page).toHaveURL(/\/automations$/);

  await page.getByRole('link', { name: 'New automation', exact: true }).first().click();
  await expect(page).toHaveURL(/\/automations\/new$/);
  await expect(page.getByRole('button', { name: 'Create automation' })).toBeDisabled();
  await page.getByRole('link', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/\/automations$/);

  await page.getByRole('link', { name: 'Sessions', exact: true }).click();
  await expect(page).toHaveURL(/\/sessions/);

  await owner.api.dispose();
});
