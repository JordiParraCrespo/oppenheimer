import { expect, type Page, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { pairedHosts } from '../../support/fleet';
import { connectInstallation, STUB_REPOSITORIES } from '../../support/sessions';
import { signInAs } from '../../support/web';

/**
 * The console's everyday journeys on a real runner, in the order a person
 * takes them: a project, a session in it that the host actually builds, the
 * session moved to another project and deleted, and the host renamed and
 * removed. Every step goes through the UI; the API is only read to prove
 * what the screen claims. Needs the console on `WEB_URL`.
 */
test.describe.configure({ timeout: 240_000 });
test.use({ baseURL: WEB_URL });

async function rowMenu(page: Page, session: string) {
  const row = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: session, exact: true }) });
  await row.hover();
  await row.getByRole('button', { name: 'Session actions' }).click();
}

test('projects, sessions and hosts round trip through the console', async ({ page }) => {
  const up = await fetch(WEB_URL).then(
    (response) => response.ok,
    () => false,
  );
  test.skip(!up, `the console is not running on ${WEB_URL}`);

  const { api, user } = await signedUpContext('journeys');
  await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'journeys');
  const project = `Wallet ${Date.now().toString(36)}`;

  await signInAs(page, user);

  // A project, from the sidebar's plus.
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByLabel('Project name').fill(project);
  await page.getByRole('checkbox', { name: new RegExp(STUB_REPOSITORIES.mobile.name) }).check();
  await page.getByRole('button', { name: box.host.name }).click();
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('button', { name: new RegExp(`^${project} \\d`) })).toBeVisible();

  // A session in it, from New session: the project prefills host and repository.
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
  const sessionId = page.url().split('/').pop() as string;

  // The host builds it: the session opens on the machine.
  async function session() {
    const response = await api.get(`/api/v1/sessions/${sessionId}`);
    return (await response.json()) as { lifecycle: string; name: string };
  }
  await expect
    .poll(async () => (await session()).lifecycle, { timeout: 120_000, intervals: [1_000, 2_000] })
    .toBe('open');
  const sessionName = (await session()).name;
  const projectHeader = page.getByRole('button', { name: new RegExp(`^${project} 1$`) });
  await expect(projectHeader).toBeVisible();

  // Move it to Unassigned from the row's menu.
  await rowMenu(page, sessionName);
  await page.getByRole('menuitem', { name: 'Move to project…' }).click();
  await page.getByRole('menuitem', { name: 'Unassigned' }).click();
  await expect(page.getByRole('button', { name: 'Unassigned 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`^${project} 0$`) })).toBeVisible();

  // Delete it: the worktree leaves the host, the row leaves the list.
  await rowMenu(page, sessionName);
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Delete session' }).click();
  await expect(dialog).toBeHidden({ timeout: 60_000 });
  // The host confirms the close and the row leaves the sidebar.
  await expect(page.getByRole('button', { name: 'Unassigned 0' })).toBeVisible({
    timeout: 30_000,
  });
  await expect
    .poll(async () => {
      const response = await api.get('/api/v1/sessions');
      const page = (await response.json()) as { data: { id: string; lifecycle: string }[] };
      return page.data.find((row) => row.id === sessionId)?.lifecycle;
    })
    .toBe('resolved');

  // Rename the host, then remove it.
  await page.goto('/settings/hosts');
  const card = page.getByTestId('host-card');
  await card.getByRole('button', { name: `${box.host.name} actions` }).click();
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  const renamed = `${box.host.name}-renamed`;
  await card.getByRole('textbox', { name: 'Host name' }).fill(renamed);
  await card.getByRole('button', { name: 'Save' }).click();
  await expect(card).toContainText(renamed);
  const hosts = await (await api.get('/api/v1/hosts')).json();
  expect((hosts as { id: string; name: string }[]).find((row) => row.id === box.id)?.name).toBe(
    renamed,
  );

  await card.getByRole('button', { name: `${renamed} actions` }).click();
  await page.getByRole('menuitem', { name: 'Remove host' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove host' }).click();
  await expect(page.getByTestId('host-card')).toHaveCount(0);
  await expect(page.getByText('No hosts yet')).toBeVisible();
});
