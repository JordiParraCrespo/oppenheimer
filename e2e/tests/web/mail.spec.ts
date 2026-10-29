import { expect, test } from '@playwright/test';
import { insertPendingBotApproval } from '../../support/db';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Settings → Mail, in a browser (`product/next-steps/mail.md` §1): the
 * reader's own Gmail accounts. Against the real control plane, a reader with
 * none sees what connecting gives their bots. The stack has no Google account
 * behind it, so the connected case answers the list, the rename and the
 * disconnect here, in the shapes the API serves; what the API does with them
 * is its own specs' (`apps/api/src/mail`). A bot's send card draws the message
 * it would send from what the card stored.
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

test('a send card shows the message exactly as it will go before it is approved', async ({
  page,
}) => {
  const owner = await provisionedUser('mailsend');
  await signInAs(page, owner.user);
  const bot = (await (
    await owner.api.post('/api/v1/bots', { data: { name: 'Ops', provider: 'glm' } })
  ).json()) as { id: string };
  await insertPendingBotApproval(
    bot.id,
    'send_mail',
    'Reply from ana@acme.test to Bo Ruiz <bo@client.test>: "Re: Invoice 42", with 1 file(s)',
    {
      account: 'Work',
      kind: 'reply',
      body: 'Hi Bo,\n\nPaid today; the receipt is attached.\n\nAna',
      plan: {
        kind: 'reply',
        connectionId: '22222222-2222-4222-8222-222222222222',
        accountEmail: 'ana@acme.test',
        from: { email: 'ana@acme.test', name: 'Ana Díaz' },
        to: ['Bo Ruiz <bo@client.test>'],
        cc: ['Cy <cy@client.test>'],
        bcc: [],
        recipientsFromMail: true,
        subject: 'Re: Invoice 42',
        body: 'Hi Bo,\n\nPaid today; the receipt is attached.\n\nAna',
        signature: true,
        original: {
          messageId: 'm1',
          from: 'Bo Ruiz <bo@client.test>',
          subject: 'Invoice 42',
          date: 'Tue, 28 Oct 2026 09:00:00 +0000',
        },
        threadId: 't1',
        attachments: [
          {
            messageId: 'm2',
            partId: '2',
            filename: 'receipt-42.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 52000,
          },
        ],
        draftId: null,
        draftMessageId: null,
      },
    },
  );

  await page.goto(`/bots/${bot.id}`);

  const message = page.getByRole('region', { name: 'The message, exactly as it goes' });
  await expect(message).toBeVisible();
  await expect(message.getByText('Ana Díaz <ana@acme.test>', { exact: true })).toBeVisible();
  await expect(message.getByText('Bo Ruiz <bo@client.test>', { exact: true })).toBeVisible();
  await expect(message.getByText('Cy <cy@client.test>', { exact: true })).toBeVisible();
  await expect(message.getByText('Re: Invoice 42', { exact: true })).toBeVisible();
  await expect(message.getByText('Paid today; the receipt is attached.')).toBeVisible();
  await expect(message.getByText('receipt-42.pdf')).toBeVisible();
  await expect(message.getByText('Taken from the message it answers')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
  await owner.api.dispose();
});
