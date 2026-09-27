import { expect, test } from '@playwright/test';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Automations, in a browser: the router setup
 * (`product/versions/mvp/13-automations.md`) — the rail's second item, the
 * list beside it, the overview's two tabs as links, the editor as a dialog
 * over the list, and the way back — rather than any automation, which
 * needs the API behind it.
 */
test('the rail switches to the automations list, and its pages link up', async ({ page }) => {
  const owner = await provisionedUser('automations');
  await signInAs(page, owner.user);
  await page.goto('/sessions');

  await page.getByRole('link', { name: 'Automations', exact: true }).click();
  await expect(page).toHaveURL(/\/automations$/);
  // The sidebar is the automations list now.
  await expect(
    page.getByRole('button', { name: 'New automation', exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'New session', exact: true })).toHaveCount(0);

  // The views are links: the address says which is open.
  await page.getByRole('link', { name: 'Runs', exact: true }).click();
  await expect(page).toHaveURL(/\/automations\/runs$/);
  await page.getByRole('link', { name: 'Automations', exact: true }).last().click();
  await expect(page).toHaveURL(/\/automations$/);

  // The editor is a dialog over the console: the address does not move, and
  // its first step gates Next until the task is named and described.
  await page.getByRole('button', { name: 'New automation', exact: true }).first().click();
  const editor = page.getByRole('dialog', { name: 'New automation' });
  await expect(editor).toBeVisible();
  await expect(page).toHaveURL(/\/automations$/);
  await expect(editor.getByRole('button', { name: 'Next' })).toBeDisabled();
  await editor.getByLabel('Name').fill('Nightly audit');
  await editor.getByLabel('What should the agent do?').fill('Audit the dependencies.');
  await expect(editor.getByRole('button', { name: 'Next' })).toBeEnabled();
  await editor.getByRole('button', { name: 'Cancel' }).click();
  await expect(editor).toHaveCount(0);

  await page.getByRole('link', { name: 'Sessions', exact: true }).click();
  await expect(page).toHaveURL(/\/sessions/);

  await owner.api.dispose();
});
