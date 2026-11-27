import { expect, test } from '@playwright/test';
import { connectInstallation, createSession, pairHost } from '../../support/sessions';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * A sidebar group's header acts on every session in it: a right-click opens
 * its menu, Hide all sessions takes every row out of the list, Show all
 * sessions brings them back once hidden sessions are listed, and Delete all
 * sessions asks once for the lot and closes each. The host is a paired row
 * with no runner, so each row waits on it as Deleting….
 */
test('a group header hides, shows and deletes every session in the group', async ({ page }) => {
  test.slow();
  const owner = await provisionedUser('group-menu');
  const hostId = await pairHost(owner.api, 'Group box');
  const installationId = await connectInstallation(owner.api);
  const ids = await Promise.all(
    [0, 1, 2].map(() => createSession(owner.api, hostId, installationId)),
  );
  const names = await Promise.all(
    ids.map(
      async (id) =>
        ((await (await owner.api.get(`/api/v1/sessions/${id}`)).json()) as { name: string }).name,
    ),
  );

  await signInAs(page, owner.user);
  await page.goto('/sessions');
  const row = (name: string) => page.getByRole('link', { name: new RegExp(`^${name}`) });
  for (const name of names) await expect(row(name)).toBeVisible();
  // The one group holding the three, by its count.
  const header = page.locator('[data-slot="sidebar-project-header"]').filter({ hasText: /3$/ });

  await header.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Hide all sessions' }).click();
  for (const name of names) await expect(row(name)).toHaveCount(0);

  await page.getByRole('button', { name: 'Filter sessions' }).click();
  await page.getByRole('menuitemcheckbox', { name: /Show hidden sessions/ }).click();
  await page.keyboard.press('Escape');
  for (const name of names) {
    await expect(row(name).getByRole('img', { name: 'Hidden' })).toBeVisible();
  }

  await header.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Show all sessions' }).click();
  for (const name of names) {
    await expect(row(name).getByRole('img', { name: 'Hidden' })).toHaveCount(0);
  }

  await header.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete all sessions…' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByText('Delete 3 sessions?')).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete sessions' }).click();
  await expect(dialog).toHaveCount(0);
  for (const name of names) await expect(row(name)).toContainText('Deleting');
});
