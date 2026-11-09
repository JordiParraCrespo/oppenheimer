import { expect, test } from '@playwright/test';
import { connectInstallation, createProject, STUB_REPOSITORIES } from '../../support/sessions';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Projects are managed in Plan's Projects view, against the real control
 * plane (`product/versions/mvp/18-plan-product.md` §1): reached from Plan's
 * sidebar, a project is a card with its repositories that opens its page,
 * where it is renamed and deleted from its settings; a delete goes back to
 * the cards. The Sessions sidebar no longer makes or edits one. Only GitHub
 * is faked.
 */
test('a project renamed and deleted from its page under Plan → Projects', async ({ page }) => {
  const owner = await provisionedUser('projects');
  const installationId = await connectInstallation(owner.api);
  await createProject(owner.api, installationId, 'Wallet');
  await signInAs(page, owner.user);

  await page.goto('/sessions');
  await expect(page.getByRole('button', { name: 'New project' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Plan', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Plan' })
    .getByText('Projects', { exact: true })
    .click();
  await expect(page).toHaveURL(/\/plan\/projects$/);
  await expect(page.getByText('Wallet', { exact: true })).toBeVisible();
  await expect(page.getByText(STUB_REPOSITORIES.mobile.name, { exact: true })).toBeVisible();

  await page.getByRole('link', { name: /^Wallet/ }).click();
  await expect(page.getByRole('heading', { name: 'Wallet', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Project settings' });
  await settings.getByLabel('Name').fill('Wallet app');
  await settings.getByRole('button', { name: 'Save changes' }).click();
  await expect(settings).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Wallet app', level: 1 })).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  await page
    .getByRole('dialog', { name: 'Project settings' })
    .getByRole('button', { name: 'Delete project' })
    .click();
  await page
    .getByRole('alertdialog', { name: /Delete “Wallet app”/ })
    .getByRole('button', { name: 'Delete project' })
    .click();
  await expect(page).toHaveURL(/\/plan\/projects$/);
  await expect(page.getByText('Wallet app', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Unassigned', { exact: true })).toBeVisible();
});
