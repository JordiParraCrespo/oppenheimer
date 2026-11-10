import { expect, type Page, test } from '@playwright/test';
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
    answeringBotId: null,
    ownerNumber: null,
    ownerPendingNumber: null,
    ownerCodeExpiresAt: null,
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

/**
 * Who answers on a connected number, in a browser
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md` §1): the bot
 * that answers by default, and the reader's own number, confirmed by a code
 * it receives and the reader enters here. The stack has no phone, so the
 * number's list and its writes answer here in the API's shapes; the bots are
 * the reader's own, made through the API. What the API does with them is its
 * own specs' (`apps/api/src/whatsapp`).
 */
const SPARE = {
  id: '77777777-7777-4777-8777-777777777777',
  hostId: '44444444-4444-4444-8444-444444444444',
  label: 'Spare',
  status: 'connected',
  hostOnline: true,
  phone: '34600111222@s.whatsapp.net',
  displayName: 'Spare',
  qr: null,
  qrExpiresAt: null,
  statusReason: null,
  answeringBotId: null as string | null,
  ownerNumber: null as string | null,
  ownerPendingNumber: null as string | null,
  ownerCodeExpiresAt: null as string | null,
  linkedAt: '2026-10-01T09:00:00Z',
};

type Spare = typeof SPARE;

async function makeBot(page: Page, name: string): Promise<{ id: string; name: string }> {
  const created = await page.request.post('/api/v1/bots', { data: { name, provider: 'glm' } });
  expect(created.ok()).toBe(true);
  return { id: ((await created.json()) as { id: string }).id, name };
}

/** Serves the number's list and its three writes from `row`, recording each write's body. */
async function serveSpare(page: Page, start: Spare) {
  const writes: { path: string; body: unknown }[] = [];
  let row = start;
  await page.route('**/v1/whatsapp/accounts', (route) => route.fulfill({ json: [row] }));
  await page.route(`**/v1/whatsapp/accounts/${row.id}**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^.*\/accounts\/[^/]+/, '');
    const body = request.postDataJSON() as Record<string, string | null>;
    writes.push({ path: `${request.method()} ${path || '/'}`, body });
    if (path === '' && request.method() === 'PATCH') {
      row = { ...row, answeringBotId: body.answeringBotId };
    } else if (path === '/owner') {
      const expires = new Date(Date.now() + 10 * 60_000).toISOString();
      row = { ...row, ownerPendingNumber: '+34600999888', ownerCodeExpiresAt: expires };
      return route.fulfill({ status: 202, json: row });
    } else if (path === '/owner/confirm' && body.code !== '424242') {
      return route.fulfill({
        status: 422,
        contentType: 'application/problem+json',
        json: {
          type: 'about:blank',
          title: 'Wrong code',
          status: 422,
          code: 'WHATSAPP_011',
          detail: 'That code is wrong or has expired.',
        },
      });
    } else if (path === '/owner/confirm') {
      row = {
        ...row,
        ownerNumber: row.ownerPendingNumber,
        ownerPendingNumber: null,
        ownerCodeExpiresAt: null,
      };
    }
    return route.fulfill({ json: row });
  });
  return writes;
}

// Breaks if the picker does not write the bot's id, if naming a number does
// not turn the row to the code, if a wrong code's refusal is not said under
// the code, or if the confirmed number is not what the row shows after.
test('the default bot is saved, and the reader names their number and enters the code it got', async ({
  page,
}) => {
  const owner = await provisionedUser('waowner');
  await signInAs(page, owner.user);
  const vega = await makeBot(page, 'Vega');
  const writes = await serveSpare(page, SPARE);

  await page.goto('/settings/whatsapp');
  const answering = page.getByTestId('whatsapp-answering');
  await expect(answering).toContainText('No bot answers on this number yet.');
  const picker = answering.getByRole('button', { name: 'The bot that answers you on Spare' });
  await picker.click();
  await page.getByRole('option', { name: 'Vega' }).click();
  await expect(picker).toContainText('Vega');
  await expect(answering).toContainText('Answers your own number.');
  expect(writes[0]).toEqual({ path: 'PATCH /', body: { answeringBotId: vega.id } });

  const ownerRow = page.getByTestId('whatsapp-owner');
  await expect(ownerRow).toContainText('Only your own number is answered.');
  const number = ownerRow.getByRole('textbox', { name: 'Your own WhatsApp number' });
  await number.fill('600');
  await ownerRow.getByRole('button', { name: 'Send code' }).click();
  await expect(ownerRow).toContainText('This is not in the expected format');
  await number.fill('+34 600 999 888');
  await ownerRow.getByRole('button', { name: 'Send code' }).click();
  await expect(ownerRow).toContainText('We sent a code to +34600999888 from this number.');
  expect(writes[1]).toEqual({ path: 'POST /owner', body: { phone: '+34 600 999 888' } });

  const code = ownerRow.getByRole('textbox', { name: 'The code your number received' });
  await code.fill('111111');
  await ownerRow.getByRole('button', { name: 'Confirm' }).click();
  await expect(ownerRow).toContainText('That code is wrong or has expired.');
  await code.fill('424242');
  await ownerRow.getByRole('button', { name: 'Confirm' }).click();
  await expect(ownerRow).toContainText('Only +34600999888 is answered here.');
  await expect(ownerRow.getByRole('button', { name: 'Change' })).toBeVisible();
  expect(writes.at(-1)).toEqual({ path: 'POST /owner/confirm', body: { code: '424242' } });
  await owner.api.dispose();
});

// Breaks if an expired code still offers the code form (the API returns the
// waiting number past its expiry), or if a host that is offline offers to
// send a code it cannot send.
test('an expired code offers a new one, and an offline host sends none', async ({ page }) => {
  const owner = await provisionedUser('waexpired');
  await signInAs(page, owner.user);
  const expired = {
    ...SPARE,
    ownerNumber: '+34600555444',
    ownerPendingNumber: '+34600999888',
    ownerCodeExpiresAt: '2026-01-01T00:00:00Z',
  };
  const writes = await serveSpare(page, expired);

  await page.goto('/settings/whatsapp');
  const ownerRow = page.getByTestId('whatsapp-owner');
  await expect(ownerRow).toContainText('The code sent to +34600999888 has expired.');
  await expect(ownerRow).toContainText('+34600555444 is still answered');
  await expect(ownerRow.getByRole('textbox')).toHaveCount(0);
  await ownerRow.getByRole('button', { name: 'Send a new code' }).click();
  await expect(
    ownerRow.getByRole('textbox', { name: 'The code your number received' }),
  ).toBeVisible();
  expect(writes).toEqual([{ path: 'POST /owner', body: { phone: '+34600999888' } }]);

  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await serveSpare(page, { ...SPARE, hostOnline: false });
  await page.reload();
  await expect(page.getByTestId('whatsapp-account')).toContainText('Host offline');
  await expect(ownerRow).toContainText('The host is offline. Start its runner to send a code.');
  await expect(ownerRow.getByRole('button', { name: 'Send code' })).toBeDisabled();
  await owner.api.dispose();
});
