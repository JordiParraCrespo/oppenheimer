import { createHash, randomUUID } from 'node:crypto';
import { expect, type Page, test } from '@playwright/test';
import { query } from '../../support/db';
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

/**
 * The "Answers you" row under a bot, against the real API: the stack has no
 * Telegram, so the connected account is the row the host would have written,
 * seeded here in SQL (`username` is what the owner link is built from), and
 * the bots that may answer are made through the API.
 */
type Seeded = { accountId: string; bots: { id: string; name: string }[] };

async function seedTelegram(
  page: Page,
  userId: string,
  account: { status?: 'connected' | 'revoked'; ownerTelegramId?: string } = {},
): Promise<Seeded> {
  const bots: { id: string; name: string }[] = [];
  for (const name of ['Juno', 'Vega']) {
    const created = await page.request.post('/api/v1/bots', { data: { name, provider: 'glm' } });
    expect(created.ok()).toBe(true);
    bots.push({ id: ((await created.json()) as { id: string }).id, name });
  }
  const [{ organizationId }] = await query<{ organizationId: string }>(
    `SELECT "organizationId" FROM bot WHERE id = $1`,
    [bots[0].id],
  );
  const hostId = randomUUID();
  await query(
    `INSERT INTO "host" ("id", "ownerUserId", "name", "publicKey", "publicKeyFingerprint")
     VALUES ($1, $2, 'devbox', 'key', $3)`,
    [hostId, userId, createHash('sha256').update(hostId).digest('hex')],
  );
  const [{ id }] = await query<{ id: string }>(
    `INSERT INTO telegram_account ("organizationId", "userId", "hostId", label, status, "botId", username, "displayName", "ownerTelegramId")
     VALUES ($1, $2, $3, 'Shop', $4, '7012345678', 'shop_helper_bot', 'Shop Helper', $5)
     RETURNING id`,
    [
      organizationId,
      userId,
      hostId,
      account.status ?? 'connected',
      account.ownerTelegramId ?? null,
    ],
  );
  return { accountId: id, bots };
}

async function answeringBotId(page: Page, accountId: string): Promise<string | null | undefined> {
  const response = await page.request.get('/api/v1/telegram/accounts');
  const rows = (await response.json()) as { id: string; answeringBotId: string | null }[];
  return rows.find((row) => row.id === accountId)?.answeringBotId;
}

// Breaks if the picker writes nothing or the wrong bot's id, if No bot does
// not clear it, or if the owner link is not the API's url, not offered first,
// or cannot be replaced from the console once it has expired or been used.
test('the bot picked to answer on Shop is saved, and the owner link is opened first and can be replaced', async ({
  page,
}) => {
  const owner = await provisionedUser('tganswer');
  await signInAs(page, owner.user);
  const { accountId, bots } = await seedTelegram(page, owner.userId);
  const [, vega] = bots;

  await page.goto('/settings/telegram');
  const row = page.getByTestId('telegram-answering');
  await expect(row).toContainText('Answers you');
  await expect(row).toContainText('Until then it answers nobody.');
  const picker = row.getByRole('button', { name: 'The bot that answers you on Shop' });
  await expect(picker).toContainText('No bot');

  await picker.click();
  await page.getByRole('option', { name: 'Vega' }).click();
  await expect.poll(() => answeringBotId(page, accountId)).toBe(vega.id);
  await page.reload();
  await expect(picker).toContainText('Vega');

  await picker.click();
  await page.getByRole('option', { name: 'No bot' }).click();
  await expect.poll(() => answeringBotId(page, accountId)).toBeNull();
  await expect(picker).toContainText('No bot');

  await row.getByRole('button', { name: 'Link your Telegram' }).click();
  const open = row.getByRole('link', { name: 'Open the link' });
  await expect(open).toHaveAttribute('href', /^https:\/\/t\.me\/shop_helper_bot\?start=/);
  await expect(open).toHaveAttribute('data-variant', 'primary');
  await expect(row).toContainText('Open the link in Telegram within ten minutes and press Start.');
  await expect(row.getByRole('button', { name: 'Link your Telegram' })).toBeHidden();
  const newLink = row.getByRole('button', { name: 'New link' });
  await expect(newLink).toHaveAttribute('data-variant', 'ghost');
  // The open link leads: it comes before the button that only makes another.
  const order = await row
    .locator('a, button')
    .evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim() ?? ''));
  expect(order.indexOf('Open the link')).toBeLessThan(order.indexOf('New link'));

  const first = await open.getAttribute('href');
  await newLink.click();
  await expect(open).not.toHaveAttribute('href', first ?? '');
  await expect(open).toHaveAttribute('href', /^https:\/\/t\.me\/shop_helper_bot\?start=/);
  await owner.api.dispose();
});

// Breaks if a linked owner is still asked to link (and never learns it worked).
test('a linked owner is told only they are answered, and is offered Link again', async ({
  page,
}) => {
  const owner = await provisionedUser('tglinked');
  await signInAs(page, owner.user);
  await seedTelegram(page, owner.userId, { ownerTelegramId: '424242' });

  await page.goto('/settings/telegram');
  const row = page.getByTestId('telegram-answering');
  await expect(row).toContainText('Your Telegram is linked: only you are answered here.');
  await expect(row.getByRole('button', { name: 'Link again' })).toBeVisible();
  await expect(row.getByRole('button', { name: 'Link your Telegram' })).toBeHidden();
  await owner.api.dispose();
});

// Breaks if a revoked bot offers a link: nobody polls it, so the link never answers.
test('a bot whose token was revoked offers no owner link', async ({ page }) => {
  const owner = await provisionedUser('tgrevoked');
  await signInAs(page, owner.user);
  await seedTelegram(page, owner.userId, { status: 'revoked' });

  await page.goto('/settings/telegram');
  // The same seed as a connected bot, which does offer Link your Telegram:
  // only the status differs. (The account row reads Host offline here, since
  // no runner holds the seeded host.)
  const row = page.getByTestId('telegram-answering');
  await expect(row).toContainText('Answers you');
  await expect(row.getByRole('button', { name: /Link/ })).toHaveCount(0);
  await expect(row.getByRole('link', { name: 'Open the link' })).toHaveCount(0);
  await owner.api.dispose();
});

// Breaks if a failed owner link fails silently, or its alert cannot be dismissed.
test('an owner link the API refuses says it did not save, and the alert can be dismissed', async ({
  page,
}) => {
  const owner = await provisionedUser('tglinkfail');
  await signInAs(page, owner.user);
  await seedTelegram(page, owner.userId);
  // The one mock here: a refusal the real API gives only in a race with the host.
  await page.route('**/v1/telegram/accounts/*/owner-link', (route) =>
    route.fulfill({
      status: 409,
      contentType: 'application/problem+json',
      body: JSON.stringify({ type: 'about:blank', title: 'Conflict', status: 409 }),
    }),
  );

  await page.goto('/settings/telegram');
  const row = page.getByTestId('telegram-answering');
  await row.getByRole('button', { name: 'Link your Telegram' }).click();
  const alert = row.getByRole('alert');
  await expect(alert).toContainText('That did not save. Try again.');
  await expect(row.getByRole('link', { name: 'Open the link' })).toHaveCount(0);
  await alert.getByRole('button', { name: 'Dismiss' }).click();
  await expect(row.getByText('That did not save. Try again.')).toBeHidden();
  await expect(row.getByRole('button', { name: 'Link your Telegram' })).toBeVisible();
  await owner.api.dispose();
});
