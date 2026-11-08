import { expect, test } from '@playwright/test';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Settings → Telegram, in a browser (`product/next-steps/telegram.md` §2): the
 * reader's own Telegram bots, each polled by the runner on one of their hosts.
 * Against the real control plane, a reader with none sees what connecting gives
 * their bots, and that a host comes first. The stack has no Telegram behind it,
 * so the connected and revoked cases answer the list, the connect and the
 * disconnect here, in the shapes the API serves; what the API does with them is
 * its own specs' (`apps/api/src/telegram`).
 */

test('a reader with no bot is told what connecting gives their bots', async ({ page }) => {
  const owner = await provisionedUser('tgempty');
  await signInAs(page, owner.user);

  await page.goto('/settings');
  await page.getByRole('link', { name: 'Telegram' }).click();

  await expect(page).toHaveURL(/\/settings\/telegram$/);
  await expect(page.getByRole('heading', { name: 'Telegram' })).toBeVisible();
  await expect(page.getByText('No Telegram bot connected')).toBeVisible();
  await expect(page.getByText('/setprivacy')).toBeVisible();
  await owner.api.dispose();
});

test('a connected bot links to Telegram, a revoked one takes a new token, and one is disconnected', async ({
  page,
}) => {
  const owner = await provisionedUser('tgrows');
  await signInAs(page, owner.user);
  const hostId = '44444444-4444-4444-8444-444444444444';
  const connected = {
    id: '55555555-5555-4555-8555-555555555555',
    hostId,
    label: 'Family',
    status: 'connected',
    hostOnline: true,
    botId: '7012345678',
    username: 'family_helper_bot',
    displayName: 'Family helper',
    statusReason: null,
    linkedAt: '2026-11-01T09:00:00Z',
  };
  const revoked = {
    ...connected,
    id: '66666666-6666-4666-8666-666666666666',
    label: 'Shop',
    status: 'revoked',
    username: 'shop_helper_bot',
    displayName: 'Shop helper',
    statusReason: 'Telegram refused that token',
  };
  let rows = [connected, revoked];
  const connects: unknown[] = [];
  await page.route('**/v1/telegram/accounts', async (route) => {
    if (route.request().method() === 'POST') {
      connects.push(route.request().postDataJSON());
      return route.fulfill({
        status: 201,
        json: { ...revoked, status: 'connecting', statusReason: null },
      });
    }
    return route.fulfill({ json: rows });
  });
  await page.route(`**/v1/telegram/accounts/${revoked.id}`, (route) => {
    rows = rows.filter((row) => row.id !== revoked.id);
    return route.fulfill({ status: 204 });
  });

  await page.goto('/settings/telegram');
  const accounts = page.getByTestId('telegram-account');
  await expect(accounts).toHaveCount(2);
  const family = accounts.filter({ hasText: 'Family' });
  await expect(family).toContainText('@family_helper_bot');
  await expect(family).toContainText('Connected');
  await expect(family.getByRole('link', { name: 'Open in Telegram' })).toHaveAttribute(
    'href',
    'https://t.me/family_helper_bot',
  );
  const shop = accounts.filter({ hasText: 'Shop' });
  await expect(shop).toContainText('Token revoked');

  await shop.getByRole('button', { name: 'Connect again' }).click();
  const dialog = page.getByRole('dialog', { name: 'Give Shop a new token' });
  await dialog.getByLabel('Bot token').fill('7012345678:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw');
  await dialog.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect
    .poll(() => connects)
    .toEqual([{ hostId, token: '7012345678:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', label: 'Shop' }]);
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Disconnect Shop' }).click();
  await page
    .getByRole('alertdialog', { name: 'Disconnect Shop?' })
    .getByRole('button', { name: 'Disconnect' })
    .click();
  await expect(accounts).toHaveCount(1);
  await expect(accounts).toContainText('Family');
  await owner.api.dispose();
});
