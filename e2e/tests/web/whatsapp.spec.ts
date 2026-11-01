import { expect, test } from '@playwright/test';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Settings → WhatsApp, in a browser (`product/next-steps/whatsapp.md` §1): the
 * reader's own numbers, each a WhatsApp linked device on one of their hosts.
 * Against the real control plane, a reader with none sees what linking gives
 * their bots, and that a host comes first. The stack has no phone behind it,
 * so the pairing and connected cases answer the list, the pairing and the
 * unlink here, in the shapes the API serves; what the API does with them is
 * its own specs' (`apps/api/src/whatsapp`).
 */

test('a reader with no number is told what linking gives their bots', async ({ page }) => {
  const owner = await provisionedUser('waempty');
  await signInAs(page, owner.user);

  await page.goto('/settings');
  await page.getByRole('link', { name: 'WhatsApp' }).click();

  await expect(page).toHaveURL(/\/settings\/whatsapp$/);
  await expect(page.getByRole('heading', { name: 'WhatsApp' })).toBeVisible();
  await expect(page.getByText('No WhatsApp number linked')).toBeVisible();
  await expect(page.getByText('Use a spare number.')).toBeVisible();
  await owner.api.dispose();
});

test('a pairing number shows its code, a logged-out one offers Pair again, and one is unlinked', async ({
  page,
}) => {
  const owner = await provisionedUser('warows');
  await signInAs(page, owner.user);
  const host = { id: '44444444-4444-4444-8444-444444444444', name: 'devbox' };
  const pairing = {
    id: '55555555-5555-4555-8555-555555555555',
    hostId: host.id,
    label: 'Spare',
    status: 'pairing',
    hostOnline: true,
    phone: null,
    displayName: null,
    qr: '2@Q2hhbmdlTWUhIGFuZCB0aGVuIHNjYW4gbWU=,Zm9vYmFy,YmF6cXV4,cXV1eA==',
    qrExpiresAt: '2099-01-01T00:00:00Z',
    statusReason: null,
    linkedAt: '2026-10-01T09:00:00Z',
  };
  const loggedOut = {
    ...pairing,
    id: '66666666-6666-4666-8666-666666666666',
    label: 'Shop',
    status: 'logged_out',
    phone: '34600111222@s.whatsapp.net',
    displayName: 'Ana',
    qr: null,
    qrExpiresAt: null,
    statusReason: 'removed from the phone',
  };
  let rows = [pairing, loggedOut];
  const paired: unknown[] = [];
  await page.route('**/v1/whatsapp/accounts', async (route) => {
    if (route.request().method() === 'POST') {
      paired.push(route.request().postDataJSON());
      return route.fulfill({
        status: 201,
        json: { ...loggedOut, status: 'pairing', statusReason: null },
      });
    }
    return route.fulfill({ json: rows });
  });
  await page.route(`**/v1/whatsapp/accounts/${loggedOut.id}`, (route) => {
    rows = rows.filter((row) => row.id !== loggedOut.id);
    return route.fulfill({ status: 204 });
  });

  await page.goto('/settings/whatsapp');
  const accounts = page.getByTestId('whatsapp-account');
  await expect(accounts).toHaveCount(2);
  await expect(accounts.filter({ hasText: 'Spare' })).toContainText('Waiting for scan');
  await expect(page.getByRole('img', { name: 'QR code to link this number' })).toBeVisible();
  const shop = accounts.filter({ hasText: 'Shop' });
  await expect(shop).toContainText('+34600111222');
  await expect(shop).toContainText('Logged out');

  await shop.getByRole('button', { name: 'Pair again' }).click();
  await expect.poll(() => paired).toEqual([{ hostId: host.id }]);

  await page.getByRole('button', { name: 'Unlink Shop' }).click();
  await page
    .getByRole('alertdialog', { name: 'Unlink Shop?' })
    .getByRole('button', { name: 'Unlink' })
    .click();
  await expect(accounts).toHaveCount(1);
  await expect(accounts).toContainText('Spare');
  await owner.api.dispose();
});
