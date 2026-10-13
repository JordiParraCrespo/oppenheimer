import { expect, test } from '@playwright/test';
import { query } from '../../support/db';
import { connectInstallation, createSession, pairHost } from '../../support/sessions';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Sharing a session from the console (`ShareSession.dc.html`), and opening it
 * as a guest.
 *
 * The owner shares from the session row's menu: Share session (who,
 * permission, for how long), then Sharing (the link, who has access, Stop
 * sharing). A second account in a browser of its own is the guest: it
 * signs in, sees the session and what the share lets it do, and, once the
 * owner stops sharing, that the session is not shared. The terminal itself
 * is the session screen's (`session.spec.ts`, and a real runner in
 * `tests/fleet/`); there is no runner here, so the session is marked open
 * the way `session.spec.ts` does and the pane is not asserted.
 */
test('a session shared as a link opens for a signed-in guest, and stops once sharing stops', async ({
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
  await expect(dialog.getByRole('heading', { name: 'Share session' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Anyone with the link' }).click();
  // A link only watches: write is there, and off.
  await expect(dialog.getByRole('radio', { name: /Can write/ })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Create link' }).click();

  await expect(dialog.getByRole('heading', { name: 'Sharing' })).toBeVisible();
  const address = dialog.getByText(/\/s\/[A-Za-z0-9_-]{22}$/);
  await expect(address).toBeVisible();
  const url = (await address.textContent())?.trim() ?? '';
  await expect(dialog.getByText('Anyone with the link')).toBeVisible();

  const guestUser = await provisionedUser('guest');
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await signInAs(guest, guestUser.user);
  await guest.goto(url);
  await expect(guest.getByText(name)).toBeVisible();
  await expect(guest.getByText('View only', { exact: true })).toBeVisible();

  await dialog.getByRole('button', { name: 'Stop sharing' }).click();
  await expect(dialog).toBeHidden();

  await guest.reload();
  await expect(guest.getByText('This session isn’t shared')).toBeVisible();
  await guestContext.close();
});
