import { expect, test } from '@playwright/test';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * The console's chrome, end to end: what the version-1 artboards draw and,
 * just as deliberately, what they do not — one column of chrome, no second bar,
 * and an account menu that is the only place appearance and language live.
 * What `useAuthorizedNav` decides is its own unit spec in the kit.
 */
test('the console is a rail, a sidebar and a pane, with no chrome bar over them', async ({
  page,
}) => {
  const owner = await provisionedUser('consoleshell');
  await signInAs(page, owner.user);

  await page.goto('/sessions');

  // The brand row names the product: the workspace is personal in version 1.
  await expect(page.getByText('Oppenheimer', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'New session', exact: true })).toBeVisible();
  // The list is grouped by project, under a head that counts them; the
  // rail to the left of it is where the console's lists are switched.
  await expect(page.getByText('Projects', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sessions', exact: true })).toBeVisible();
  // Side by side, not stacked: the sidebar's panel is fixed to the viewport,
  // and it once started under the rail, which hid its first column.
  // Polled, because the panel animates its `left` into place.
  const rail = await page.getByRole('navigation', { name: 'Main navigation' }).boundingBox();
  await expect
    .poll(
      async () => (await page.getByRole('textbox', { name: 'Search sessions' }).boundingBox())?.x,
    )
    .toBeGreaterThanOrEqual((rail?.x ?? 0) + (rail?.width ?? 0));

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
  // Settings is the menu's one link (the 2026-09-26 export); Profile is not
  // hidden behind a permission — it is not a page.
  await expect(menu.getByRole('menuitem', { name: 'Settings' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'View profile' })).toHaveCount(0);

  await owner.api.dispose();
});

test('a URL the console does not have answers inside the shell', async ({ page }) => {
  const owner = await provisionedUser('console404');
  await signInAs(page, owner.user);

  await page.goto('/nowhere');

  // The 404 keeps the sidebar: the reader is still in the product, with New
  // session one click away, rather than on a bare page — the sidebar's link,
  // and the page's own offer of the same.
  await expect(page.getByRole('link', { name: 'New session', exact: true })).toHaveCount(2);
  await expect(page.getByText('That page does not exist')).toBeVisible();

  await owner.api.dispose();
});
