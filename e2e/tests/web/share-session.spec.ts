import { expect, test } from '@playwright/test';
import { query } from '../../support/db';
import { connectInstallation, createSession, pairHost } from '../../support/sessions';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Sharing a session from the console, and opening the link signed out.
 *
 * The owner shares from the session row's menu; the dialog answers with the
 * address once, as `/shared#<secret>`, and lists the live link with Revoke. A
 * second, empty browser context is the holder: it sees what the link opens
 * and who shared it, and, once revoked, that it opens nothing. The terminal
 * itself is the session screen's (`session.spec.ts`, and a real runner in
 * `tests/fleet/`); there is no runner here, so the session is marked open the
 * way `session.spec.ts` does and the pane is not asserted.
 */
test('a session shared to anyone opens signed out, and stops opening once revoked', async ({
  page,
  browser,
}) => {
  test.slow();
  const owner = await provisionedUser('sharer');
  const hostId = await pairHost(owner.api, 'Shared box');
  const installationId = await connectInstallation(owner.api);
  const sessionId = await createSession(owner.api, hostId, installationId);
  await query(`UPDATE "work_session" SET "state" = 'open' WHERE "id" = $1`, [sessionId]);
  const { name } = (await (await owner.api.get(`/api/v1/sessions/${sessionId}`)).json()) as {
    name: string;
  };

  await signInAs(page, owner.user);
  const row = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name, exact: true }) });
  await row.hover();
  await row.getByRole('button', { name: 'Session actions' }).click();
  await page.getByRole('menuitem', { name: 'Share…' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('No active links.')).toBeVisible();
  await dialog.getByText('Anyone with the link', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Create link' }).click();

  const address = dialog.getByText(/\/shared#[A-Za-z0-9_-]{43}$/);
  await expect(address).toBeVisible();
  const url = (await address.textContent())?.trim() ?? '';
  await expect(dialog.getByRole('button', { name: 'Revoke' })).toHaveCount(1);

  const holder = await browser.newContext();
  const shared = await holder.newPage();
  await shared.goto(url);
  await expect(shared.getByRole('heading', { name })).toBeVisible();
  await expect(shared.getByText('Watching')).toBeVisible();

  await dialog.getByRole('button', { name: 'Revoke' }).click();
  await expect(dialog.getByText('No active links.')).toBeVisible();

  await shared.reload();
  await expect(shared.getByText('This link doesn’t open anything')).toBeVisible();
  await holder.close();
});
