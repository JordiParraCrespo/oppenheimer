import { expect, test } from '@playwright/test';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Settings → Mail, in a browser (`product/next-steps/mail.md` §1): the
 * reader's own Gmail accounts. Against the real control plane, a reader with
 * none sees what connecting gives their bots. The stack has no Google account
 * behind it, so the connected case answers the list, the rename and the
 * disconnect here, in the shapes the API serves; what the API does with them
 * is its own specs' (`apps/api/src/mail`).
 */

test('a reader with no Gmail account is told what connecting gives their bots', async ({
  page,
}) => {
  const owner = await provisionedUser('mailempty');
  await signInAs(page, owner.user);

  await page.goto('/settings');
  await page.getByRole('link', { name: 'Mail' }).click();

  await expect(page).toHaveURL(/\/settings\/mail$/);
  await expect(page.getByRole('heading', { name: 'Mail' })).toBeVisible();
  await expect(page.getByText('No Gmail account connected')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect Gmail' })).toBeVisible();
  await owner.api.dispose();
});

test('a connected account is renamed and disconnected, and one Google dropped offers Reconnect', async ({
  page,
}) => {
  const owner = await provisionedUser('mailrows');
  await signInAs(page, owner.user);
  const work = {
    id: '22222222-2222-4222-8222-222222222222',
    accountEmail: 'ana@acme.test',
    label: 'ana',
    status: 'active',
    connectedAt: '2026-10-01T09:00:00Z',
  };
  const personal = {
    id: '33333333-3333-4333-8333-333333333333',
    accountEmail: 'ana@gmail.test',
    label: 'Personal',
    status: 'revoked',
    connectedAt: '2026-10-02T09:00:00Z',
  };
  let rows = [work, personal];
  const renamed: unknown[] = [];
  await page.route('**/v1/mail/gmail/connections', (route) => route.fulfill({ json: rows }));
  await page.route(`**/v1/mail/gmail/connections/${work.id}`, async (route) => {
    if (route.request().method() === 'PATCH') {
      renamed.push(route.request().postDataJSON());
      return route.fulfill({ json: { ...work, label: 'Work' } });
    }
    rows = rows.filter((row) => row.id !== work.id);
    return route.fulfill({ status: 204 });
  });

  await page.goto('/settings/mail');
  const accounts = page.getByTestId('gmail-account');
  await expect(accounts).toHaveCount(2);
  await expect(accounts.filter({ hasText: 'ana@gmail.test' })).toContainText('Needs reconnecting');
  await expect(
    accounts.filter({ hasText: 'ana@gmail.test' }).getByRole('button', { name: 'Reconnect' }),
  ).toBeVisible();
  await expect(
    accounts.filter({ hasText: 'ana@acme.test' }).getByRole('button', { name: 'Reconnect' }),
  ).toHaveCount(0);

  await accounts
    .filter({ hasText: 'ana@acme.test' })
    .getByRole('button', { name: 'Rename' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Rename account' });
  await dialog.getByLabel('Name').fill('Work');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  expect(renamed).toEqual([{ label: 'Work' }]);
  await expect(accounts.filter({ hasText: 'ana@acme.test' })).toContainText('Work');

  await page.getByRole('button', { name: 'Disconnect ana@acme.test' }).click();
  await page
    .getByRole('alertdialog', { name: 'Disconnect ana@acme.test?' })
    .getByRole('button', { name: 'Disconnect' })
    .click();
  await expect(accounts).toHaveCount(1);
  await expect(accounts).toContainText('ana@gmail.test');
  await owner.api.dispose();
});
