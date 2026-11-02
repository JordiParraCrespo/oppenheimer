import { expect, test } from '@playwright/test';
import { insertBotActivity, insertPendingBotApproval, insertScheduledMail } from '../../support/db';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Settings → Mail, in a browser (`product/next-steps/mail.md` §1): the
 * reader's own Gmail accounts. Against the real control plane, a reader with
 * none sees what connecting gives their bots. The stack has no Google account
 * behind it, so the connected case answers the list, the rename and the
 * disconnect here, in the shapes the API serves; what the API does with them
 * is its own specs' (`apps/api/src/mail`). A bot's send card draws the message
 * it would send from what the card stored, in the chat and in the Inbox, and a
 * draft it saved shows as a card under the call. Mail a bot scheduled is listed
 * under Settings → Mail and cancelled there, against the real API.
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

/** A reply as a send card stores it: the message exactly as it will go. */
const REPLY = {
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
      source: 'mail',
      messageId: 'm2',
      partId: '2',
      filename: 'receipt-42.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 52000,
    },
  ],
  draftId: null,
  draftMessageId: null,
};

test('a send card shows the message exactly as it will go, in the chat and in the Inbox', async ({
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
    { account: 'Work', kind: 'reply', body: REPLY.body, plan: REPLY },
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

  // The Inbox draws the same message where it would otherwise show the call's input.
  await page.goto('/');
  const inInbox = page.getByRole('region', { name: 'The message, exactly as it goes' });
  await expect(inInbox).toBeVisible();
  await expect(inInbox.getByText('Re: Invoice 42', { exact: true })).toBeVisible();
  await expect(inInbox.getByText('receipt-42.pdf')).toBeVisible();
  await owner.api.dispose();
});

test('a draft the bot saved shows under its call, with Open in Gmail', async ({ page }) => {
  const owner = await provisionedUser('maildraft');
  await signInAs(page, owner.user);
  const bot = (await (
    await owner.api.post('/api/v1/bots', { data: { name: 'Ops', provider: 'glm' } })
  ).json()) as { id: string };
  const link = 'https://mail.google.com/mail/?authuser=ana%40acme.test#drafts?compose=r-123';
  await insertBotActivity(bot.id, [
    {
      callId: 'call-1',
      name: 'create_draft',
      input: { account: 'Work', kind: 'reply', message_id: 'm1' },
      output: 'Draft saved in ana@acme.test (draft id r-9); nothing was sent.',
      isError: false,
      sessionId: null,
      subagents: null,
      mailDraft: { saved: 'created', draftId: 'r-9', link, mail: REPLY },
    },
  ]);

  await page.goto(`/bots/${bot.id}`);

  const draft = page.getByRole('region', { name: 'The message, exactly as it goes' });
  await expect(draft).toBeVisible();
  await expect(draft.getByText('Re: Invoice 42', { exact: true })).toBeVisible();
  await expect(
    draft.getByText('Saved as a draft in ana@acme.test. Nothing was sent.'),
  ).toBeVisible();
  await expect(draft.getByRole('link', { name: 'Open in Gmail' })).toHaveAttribute('href', link);
  await owner.api.dispose();
});

test('scheduled mail is listed in Settings → Mail and cancelled there', async ({ page }) => {
  const owner = await provisionedUser('mailsched');
  await signInAs(page, owner.user);
  const bot = (await (
    await owner.api.post('/api/v1/bots', { data: { name: 'Ops', provider: 'glm' } })
  ).json()) as { id: string };
  const day = 24 * 60 * 60 * 1000;
  await insertScheduledMail(
    bot.id,
    owner.userId,
    'Invoice 42 reminder',
    new Date(Date.now() + day),
  );
  await insertScheduledMail(
    bot.id,
    owner.userId,
    'Quarterly report',
    new Date(Date.now() + 3 * day),
  );

  await page.goto('/settings/mail');

  await expect(page.getByRole('heading', { name: 'Scheduled' })).toBeVisible();
  const rows = page.getByTestId('scheduled-mail');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('Invoice 42 reminder');
  await expect(rows.first()).toContainText('To Bo Ruiz <bo@client.test> · from ana@acme.test');

  await page.getByRole('button', { name: 'Cancel “Invoice 42 reminder”' }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Quarterly report');

  // The cancel is the server's: it is gone after a reload too.
  await page.reload();
  await expect(page.getByTestId('scheduled-mail')).toHaveCount(1);
  await owner.api.dispose();
});
