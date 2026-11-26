import { expect, test } from '@playwright/test';
import { query } from '../../support/db';
import { connectInstallation, createSession, pairHost } from '../../support/sessions';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Sharing a session from the console (`ShareSession.dc.html`), and opening it
 * as a guest.
 *
 * The owner shares from the session row's menu: Share session, its general
 * access set to the link, then Create link; the panel then lists who has
 * access, copies the link and stops sharing. A second account in a browser of its own is the guest: it
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
  // Signing in lands on the Inbox; the session's row is under Sessions.
  await page.goto('/sessions');
  const row = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name, exact: true }) });
  await row.hover();
  await row.getByRole('button', { name: 'Session actions' }).click();
  await page.getByRole('menuitem', { name: 'Share…' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Share session' })).toBeVisible();
  await dialog.getByRole('button', { name: 'General access' }).click();
  await page.getByRole('menuitemradio', { name: /Anyone with the link/ }).click();
  // A link only watches: write is there, and off.
  await dialog.getByRole('button', { name: 'Permission' }).click();
  await expect(page.getByRole('menuitemradio', { name: /Can write/ })).toBeDisabled();
  await page.keyboard.press('Escape');
  await dialog.getByRole('button', { name: 'Create link' }).click();

  await expect(dialog.getByRole('button', { name: 'Stop sharing' })).toBeVisible();
  await expect(dialog.getByText('Anyone with the link', { exact: true })).toBeVisible();
  const url = (await dialog.getByRole('button', { name: 'Copy link' }).getAttribute('title')) ?? '';
  expect(url).toMatch(/\/s\/[A-Za-z0-9_-]{22}$/);

  const guestUser = await provisionedUser('guest');
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await signInAs(guest, guestUser.user);
  await guest.goto(url);
  await expect(guest.getByText(name)).toBeVisible();
  await expect(guest.getByText('View only', { exact: true })).toBeVisible();

  await dialog.getByRole('button', { name: 'Stop sharing' }).click();
  await expect(dialog.getByRole('button', { name: 'Create link' })).toBeVisible();

  await guest.reload();
  await expect(guest.getByText('This session isn’t shared')).toBeVisible();
  await guestContext.close();
});

/**
 * Inviting someone to a share that can already write gives them a shell on
 * the host as the sharer, so the invite line says so and Invite waits until
 * the sharer ticks that they understand.
 */
test('inviting someone to a share that can write asks to be understood first', async ({ page }) => {
  test.slow();
  const owner = await provisionedUser('sharer');
  const hostId = await pairHost(owner.api, 'Shared box');
  const installationId = await connectInstallation(owner.api);
  const sessionId = await createSession(owner.api, hostId, installationId);
  await query(`UPDATE "work_session" SET "state" = 'open' WHERE "id" = $1`, [sessionId]);
  const put = await owner.api.put(`/api/v1/sessions/${sessionId}/share`, {
    data: { audience: 'people', access: 'write', people: ['ada@example.com'], lifetime: '1h' },
  });
  expect(put.status(), await put.text()).toBe(200);

  await signInAs(page, owner.user);
  await page.goto(`/sessions/${sessionId}`);
  await page.getByRole('button', { name: /Shared · can write/ }).click();
  const panel = page.getByRole('dialog');
  const field = panel.getByPlaceholder('Add people by email');
  await field.fill('bob@example.com');
  await field.press('Enter');

  await expect(panel.getByText('bob@example.com will act as you on Shared box.')).toBeVisible();
  const invite = panel.getByRole('button', { name: 'Invite' });
  await expect(invite).toBeDisabled();
  await panel.getByRole('checkbox', { name: 'I understand' }).click();
  await invite.click();

  await expect(panel.getByRole('listitem').filter({ hasText: 'bob@example.com' })).toBeVisible();
  const { share } = (await (await owner.api.get(`/api/v1/sessions/${sessionId}/share`)).json()) as {
    share: { people: string[] };
  };
  expect(share.people).toEqual(['ada@example.com', 'bob@example.com']);
});
