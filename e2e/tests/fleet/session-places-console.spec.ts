import { expect, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { pairedHosts } from '../../support/fleet';
import { waitForLifecycle } from '../../support/sessions';
import { signInAs } from '../../support/web';

/**
 * Where a session runs, from the console to a real runner
 * (`product/versions/mvp/24-session-places.md`): New session's Where chip and
 * folder picker start a session in a folder the host already has, Settings'
 * Open terminal starts a blank terminal in the home directory, and the
 * sidebar and the delete dialog say what each one is. Needs the console on
 * `WEB_URL`.
 */
test.describe.configure({ timeout: 240_000 });
test.use({ baseURL: WEB_URL });

test('a folder session from the picker, and a blank terminal from Settings', async ({ page }) => {
  const up = await fetch(WEB_URL).then(
    (response) => response.ok,
    () => false,
  );
  test.skip(!up, `the console is not running on ${WEB_URL}`);

  const { api, user } = await signedUpContext('fleetplacesui');
  const [box] = await pairedHosts(api, 1, 'places-ui');
  const home = box.host.exec('echo $HOME');
  const folder = `${home}/code/atlas`;
  box.host.exec(`mkdir -p ${folder}/apps && git -C ${folder} init -q -b port-121`);

  await signInAs(page, user);
  await page.goto('/sessions/new');

  // Where: a folder on the host. The scope row turns into host, folder, project.
  await page.getByRole('button', { name: 'Where the session runs' }).click();
  await page.getByRole('option', { name: /Folder on host/ }).click();
  await expect(page.getByRole('button', { name: 'Where the session runs' })).toContainText(
    'Folder on host',
  );
  await expect(page.getByRole('button', { name: 'Project', exact: true })).toContainText(
    'Unassigned',
  );

  await page.getByRole('button', { name: 'Host', exact: true }).click();
  await page.getByRole('option', { name: new RegExp(box.host.name) }).click();

  // The picker lists the host's folders through its runner: drill into code,
  // then atlas, which is a repository on its own branch.
  await page.getByRole('button', { name: 'Folder', exact: true }).click();
  await page.getByRole('option', { name: /^code/ }).click();
  await expect(page.getByRole('option', { name: /atlas/ })).toContainText('port-121');
  await page.getByRole('option', { name: /atlas/ }).click();
  await expect(
    page.getByText('Git repository on port-121. Opened as it is, no new branch.'),
  ).toBeVisible();

  // A path that is not there cannot be used.
  const input = page.getByRole('textbox', { name: 'Folder path' });
  await input.fill('~/code/nowhere/');
  await expect(page.getByText('Pick an existing folder. Nothing is created.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Use/ })).toBeDisabled();
  await input.fill('~/code/atlas/');
  await page.getByRole('button', { name: 'Use atlas' }).click();
  await expect(page.getByRole('button', { name: 'Folder', exact: true })).toContainText(
    '~/code/atlas',
  );

  await page.getByRole('textbox').last().fill('List what is here');
  await page.getByRole('button', { name: /send/i }).click();
  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const folderSessionId = page.url().split('/').pop() as string;
  const opened = await waitForLifecycle(api, folderSessionId, 'open');
  const detail = (await (await api.get(`/api/v1/sessions/${folderSessionId}`)).json()) as {
    place: string;
    folderPath: string;
  };
  expect(detail).toMatchObject({ place: 'folder', folderPath: folder });
  expect(box.host.exec(`test -e ${folder}/.oppenheimer && echo marked || echo clean`)).toBe(
    'clean',
  );

  // The sidebar marks it as a folder session, and its delete says the folder stays.
  const row = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: opened.name, exact: true }) });
  await expect(row.locator('svg.lucide-folder')).toHaveCount(1);
  await row.hover();
  await row.getByRole('button', { name: 'Session actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('The folder stays as it is.');
  await expect(dialog.getByRole('checkbox')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Delete session' }).click();
  await waitForLifecycle(api, folderSessionId, 'resolved', 60_000);
  expect(box.host.exec(`test -d ${folder}/apps && echo kept`)).toBe('kept');

  // Settings: Open terminal starts a blank terminal in ~ on that host, at once.
  await page.goto('/settings/hosts');
  const card = page.getByTestId('host-card').filter({ hasText: box.host.name });
  await card.getByRole('link', { name: 'Open terminal' }).click();
  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const terminalId = page.url().split('/').pop() as string;
  await waitForLifecycle(api, terminalId, 'open');
  const terminal = (await (await api.get(`/api/v1/sessions/${terminalId}`)).json()) as {
    agent: string;
    place: string;
    folderPath: string;
    name: string;
  };
  expect(terminal).toMatchObject({ agent: 'shell', place: 'folder', folderPath: home });
  await expect(
    page
      .getByRole('listitem')
      .filter({ has: page.getByRole('link', { name: terminal.name, exact: true }) })
      .locator('svg.lucide-square-terminal'),
  ).toHaveCount(1);
  // Going back does not start a second one.
  await page.goBack();
  await page.waitForTimeout(2_000);
  const sessions = (await (await api.get('/api/v1/sessions')).json()) as
    | { data: { id: string; lifecycle: string }[] }
    | { id: string; lifecycle: string }[];
  const rows = Array.isArray(sessions) ? sessions : sessions.data;
  expect(rows.filter((row) => row.lifecycle !== 'resolved')).toHaveLength(1);
});
