import { expect, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { pairedHosts } from '../../support/fleet';
import { connectInstallation, STUB_REPOSITORIES, waitForLifecycle } from '../../support/sessions';
import { signInAs } from '../../support/web';

/**
 * A project's journey through the console on a real runner: made from the
 * sidebar's plus, picked on New session so its defaults fill the host and the
 * repository, a session sent from it that the host builds, that session moved
 * to Unassigned from its row, and the host renamed from Settings. Every step is
 * the UI; the API is read only to prove what the screen claims. Delete and
 * Remove host have specs of their own. Needs the console on `WEB_URL`.
 */
test.describe.configure({ timeout: 180_000 });
test.use({ baseURL: WEB_URL });

test('a project made in the console starts a session its host builds', async ({ page }) => {
  const up = await fetch(WEB_URL).then(
    (response) => response.ok,
    () => false,
  );
  test.skip(!up, `the console is not running on ${WEB_URL}`);

  const { api, user } = await signedUpContext('fleetproject');
  await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'project');
  const project = `Wallet ${Date.now().toString(36)}`;
  const header = (count: number) =>
    page.getByRole('button', { name: `${project} ${count}`, exact: true });

  await signInAs(page, user);

  // New project is a dialog over the console: the name, a repository added
  // from the field (cloned by default), the default host in the Defaults fold.
  await page.getByRole('button', { name: 'New project' }).click();
  const dialog = page.getByRole('dialog', { name: 'New project' });
  await dialog.getByLabel('Name').fill(project);
  await dialog.getByRole('button', { name: 'Add a repository…' }).click();
  await dialog.getByRole('option', { name: new RegExp(STUB_REPOSITORIES.mobile.name) }).click();
  await dialog.getByRole('button', { name: /^Defaults/ }).click();
  await dialog.getByRole('button', { name: box.host.name }).click();
  await dialog.getByRole('button', { name: 'Create project' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(header(0)).toBeVisible();

  await page.goto('/sessions/new');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('option', { name: project }).click();
  await expect(page.getByRole('button', { name: 'Host' })).toContainText(box.host.name);
  await expect(page.getByRole('button', { name: 'Repositories' })).toContainText(
    STUB_REPOSITORIES.mobile.name,
  );
  await page.getByRole('textbox', { name: /Describe a task/ }).fill('Fix the empty wallet state');
  await page.getByRole('button', { name: /send/i }).click();
  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const sessionId = new URL(page.url()).pathname.split('/').pop() ?? '';
  const { name } = await waitForLifecycle(api, sessionId, 'open');
  await expect(header(1)).toBeVisible();

  const row = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name, exact: true }) });
  await row.hover();
  await row.getByRole('button', { name: 'Session actions' }).click();
  await page.getByRole('menuitem', { name: 'Move to project…' }).click();
  await page.getByRole('menuitem', { name: 'Unassigned' }).click();
  await expect(page.getByRole('button', { name: 'Unassigned 1' })).toBeVisible();
  await expect(header(0)).toBeVisible();

  await page.goto('/settings/hosts');
  const card = page.getByTestId('host-card');
  await card.getByRole('button', { name: `${box.host.name} actions` }).click();
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  const renamed = `${box.host.name}-renamed`;
  await card.getByRole('textbox', { name: 'Host name' }).fill(renamed);
  await card.getByRole('button', { name: 'Save' }).click();
  await expect(card).toContainText(renamed);
  const hosts = (await (await api.get('/api/v1/hosts')).json()) as { id: string; name: string }[];
  expect(hosts.find((host) => host.id === box.id)?.name).toBe(renamed);
});
