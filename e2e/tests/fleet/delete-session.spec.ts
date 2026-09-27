import { expect, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { pairedHosts } from '../../support/fleet';
import { connectInstallation, createSession, waitForLifecycle } from '../../support/sessions';
import { signInAs } from '../../support/web';

/**
 * Delete from a sidebar row, on a real runner: the close is a request the host
 * answers, so the row stays until the host resolves the session, then leaves.
 * Needs the console on `WEB_URL`.
 */
test.describe.configure({ timeout: 180_000 });
test.use({ baseURL: WEB_URL });

test('a deleted session leaves the sidebar once its host has closed it', async ({ page }) => {
  const up = await fetch(WEB_URL).then(
    (response) => response.ok,
    () => false,
  );
  test.skip(!up, `the console is not running on ${WEB_URL}`);

  const { api, user } = await signedUpContext('fleetdelete');
  const installationId = await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'delete');
  const sessionId = await createSession(api, box.id, installationId);
  const { name } = await waitForLifecycle(api, sessionId, 'open');

  await signInAs(page, user);
  await expect(page.getByRole('button', { name: 'Unassigned 1' })).toBeVisible();
  const row = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name, exact: true }) });
  await row.hover();
  await row.getByRole('button', { name: 'Session actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Delete session' }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole('button', { name: 'Unassigned 0' })).toBeVisible({
    timeout: 30_000,
  });
  await waitForLifecycle(api, sessionId, 'resolved', 10_000);
});
