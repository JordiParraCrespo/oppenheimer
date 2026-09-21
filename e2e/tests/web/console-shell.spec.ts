import { expect, test } from '@playwright/test';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * The console's chrome, end to end: what the version-1 artboards draw and,
 * just as deliberately, what they do not.
 *
 * This replaces a permissions spec over a nav list that no longer exists. The
 * sidebar is the session list now, so there are no gated rows to hide from a
 * restricted reader — what `useAuthorizedNav` still decides is covered by its
 * own unit spec in the kit. What needs a real browser is the shape of the
 * shell: one column of chrome, no second bar, and an account menu that is the
 * only place appearance and language live.
 */
test('the console is a sidebar and a pane, with no chrome bar over them', async ({ page }) => {
  const owner = await provisionedUser('consoleshell');
  await signInAs(page, owner.user);

  await page.goto('/sessions');

  // The brand row names the product: the workspace is personal in version 1.
  await expect(page.getByText('Oppenheimer', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'New session', exact: true })).toBeVisible();
  await expect(page.getByText('Sessions', { exact: true })).toBeVisible();

  // The starter's chrome bar and its search trigger are gone with it.
  await expect(page.getByRole('button', { name: 'Search' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Toggle sidebar' })).toHaveCount(0);

  await owner.api.dispose();
});

test('the account menu holds appearance, language and the way out — and nothing else', async ({
  page,
}) => {
  const owner = await provisionedUser('consolemenu');
  await signInAs(page, owner.user);
  await page.goto('/sessions');

  await page
    .getByRole('button', { name: `${owner.user.firstName} ${owner.user.lastName}` })
    .click();
  const menu = page.getByRole('menu').first();

  await expect(menu.getByText(owner.user.email)).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Appearance' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Language' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Log out' })).toBeVisible();
  // Settings and Profile are not hidden behind a permission — they are gone.
  await expect(menu.getByRole('menuitem', { name: 'Settings' })).toHaveCount(0);
  await expect(menu.getByRole('menuitem', { name: 'View profile' })).toHaveCount(0);

  await owner.api.dispose();
});

test('a URL the console does not have answers inside the shell', async ({ page }) => {
  const owner = await provisionedUser('console404');
  await signInAs(page, owner.user);

  await page.goto('/settings');

  // The 404 keeps the sidebar: the reader is still in the product, with New
  // session one click away, rather than on a bare page.
  await expect(page.getByRole('link', { name: 'New session', exact: true })).toBeVisible();
  await expect(page.getByText('That page does not exist')).toBeVisible();

  await owner.api.dispose();
});
