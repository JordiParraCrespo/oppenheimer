import { expect, test } from '@playwright/test';
import { connectInstallation, createSession, pairHost } from '../../support/sessions';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * A session a bot or a script started hidden stays out of the sidebar until
 * Show hidden sessions lists it, marked Hidden; Show in its menu brings it
 * back for good, and Hide in another row's menu takes that one out.
 */
test('a session started hidden is listed only once hidden sessions are shown', async ({ page }) => {
  test.slow();
  const owner = await provisionedUser('hider');
  const hostId = await pairHost(owner.api, 'Hide box');
  const installationId = await connectInstallation(owner.api);
  const shownId = await createSession(owner.api, hostId, installationId);
  const hiddenId = await createSession(owner.api, hostId, installationId, { hidden: true });
  const [shownName, hiddenName] = await Promise.all(
    [shownId, hiddenId].map(
      async (id) =>
        ((await (await owner.api.get(`/api/v1/sessions/${id}`)).json()) as { name: string }).name,
    ),
  );

  await signInAs(page, owner.user);
  await page.goto('/sessions');
  // A hidden row's name carries its Hidden mark, so a row is found by how its name starts.
  const row = (name: string) => page.getByRole('link', { name: new RegExp(`^${name}`) });
  await expect(row(shownName)).toBeVisible();
  await expect(row(hiddenName)).toHaveCount(0);

  await page.getByRole('button', { name: 'Filter sessions' }).click();
  await page.getByRole('menuitemcheckbox', { name: /Show hidden sessions/ }).click();
  await page.keyboard.press('Escape');
  await expect(row(hiddenName)).toBeVisible();
  await expect(row(hiddenName)).toContainText('Hidden');

  // Show is the session's own: it stays listed once the toggle is off again.
  await row(hiddenName).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Show', exact: true }).click();
  await expect(row(hiddenName)).not.toContainText('Hidden');

  // And Hide takes the other one out of the list.
  await row(shownName).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Hide', exact: true }).click();
  await page.getByRole('button', { name: 'Filter sessions' }).click();
  await page.getByRole('menuitemcheckbox', { name: /Show hidden sessions/ }).click();
  await page.keyboard.press('Escape');
  await expect(row(shownName)).toHaveCount(0);
  await expect(row(hiddenName)).toBeVisible();
});
