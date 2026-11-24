import { expect, test } from '@playwright/test';
import { insertPendingBotApproval } from '../../support/db';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * The Inbox in a browser, against the real control plane: the console lands on
 * the Inbox, the rail's first item, a workspace with nothing waiting reads
 * "You're all caught up", a bot's pending approval comes in as a mail row and
 * as the card on the deck, Approve first, with no Done on the dock while the
 * bot waits, and the row's menu marks it done: the row stays under Show done for the visit, the mark is stored, and
 * the deck is clear again.
 */
test('the Inbox: clear, an approval comes in, and Mark as done', async ({ page }) => {
  const owner = await provisionedUser('inbox');
  await signInAs(page, owner.user);

  await expect(page).toHaveURL(/\/inbox/);
  await expect(
    page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Inbox' }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText("You're all caught up", { exact: true })).toBeVisible();
  await expect(page.getByText('Nothing needs you.', { exact: true })).toBeVisible();

  const bot = (await (
    await owner.api.post('/api/v1/bots', { data: { name: 'Ops', provider: 'glm' } })
  ).json()) as { id: string };
  const approvalId = await insertPendingBotApproval(
    bot.id,
    'start_session',
    'Start a session on acme/app to fix the flaky login test.',
  );
  await page.reload();

  const row = page.getByRole('link', { name: /Approve Ops · start_session/ });
  await expect(row).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ops wants to run start_session' })).toBeVisible();
  const message = page.locator('[data-slot="inbox-message"]');
  await expect(
    message.getByText('Start a session on acme/app to fix the flaky login test.'),
  ).toBeVisible();
  const answers = message.locator('[data-slot="inbox-message-actions"]').getByRole('button');
  await expect(answers).toHaveText(['Approve', 'Deny']);
  await expect(page.getByText('1 of 1', { exact: true })).toBeVisible();

  // A bot that waits on its approval has no Done on the dock, and E does nothing.
  const dock = page.getByRole('toolbar', { name: 'Move through the Inbox' });
  await expect(dock.getByRole('button', { name: 'Next' })).toBeVisible();
  await expect(dock.getByRole('button', { name: 'Done' })).toHaveCount(0);
  await page.keyboard.press('e');
  await expect(row).toBeVisible();

  // The row's menu still marks it done.
  await row.hover();
  await page
    .locator('[data-slot="inbox-row"]', { has: row })
    .getByRole('button', { name: 'Item actions' })
    .click();
  await page.getByRole('menuitem', { name: /Mark as done/ }).click();

  await expect(page.getByText("You're all caught up", { exact: true })).toBeVisible();
  // What is marked done leaves the list; Show done brings it back for the visit.
  await expect(page.locator('[data-slot="inbox-item"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Filter the Inbox' }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Show done' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-slot="inbox-item"][data-done]')).toHaveCount(1);

  // The mark is the server's: it is there after a reload, the done row is not.
  await expect
    .poll(
      async () =>
        (await (await owner.api.get('/api/v1/inbox/marks')).json()) as {
          itemKey: string;
          mark: string;
        }[],
    )
    .toEqual([expect.objectContaining({ itemKey: `approval:${approvalId}`, mark: 'done' })]);
  await page.reload();
  await expect(page.getByText("You're all caught up", { exact: true })).toBeVisible();
  await expect(page.locator('[data-slot="inbox-item"]')).toHaveCount(0);

  // The address it had while it was Plan's section still opens it.
  await page.goto('/plan/inbox');
  await expect(page).toHaveURL(/\/inbox$/);

  await owner.api.dispose();
});

/**
 * Bulk actions: Select in the list's head opens the selection bar with every
 * row's checkbox shown and nothing done until a row is checked; X checks the
 * item on the deck; Mark as done there marks every checked row in one
 * request, leaving the unchecked one in the list.
 */
test('the Inbox: select rows and mark them done at once', async ({ page }) => {
  const owner = await provisionedUser('inbox-bulk');
  await signInAs(page, owner.user);

  // A bot holds one pending approval at a time: one bot per row.
  const ids: string[] = [];
  for (const name of ['Ops', 'Docs', 'Release']) {
    const bot = (await (
      await owner.api.post('/api/v1/bots', { data: { name, provider: 'glm' } })
    ).json()) as { id: string };
    ids.push(await insertPendingBotApproval(bot.id, 'start_session', `${name} wants a session.`));
  }
  await page.goto('/inbox');
  const rows = page.locator('[data-slot="inbox-row"]');
  await expect(rows).toHaveCount(3);

  const batch = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/inbox/marks/batch'),
  );
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  const bar = page.getByRole('toolbar', { name: 'Selected items' });
  await expect(bar.getByText('0 selected')).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Mark as done' })).toBeDisabled();
  // One Escape leaves selecting, even with a row checked: it once only
  // unchecked the row and left the bar up at "0 selected".
  await page.keyboard.press('x');
  await expect(bar.getByText('1 selected')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(bar).toBeHidden();

  await page.getByRole('button', { name: 'Select', exact: true }).click();
  // X checks the item on the deck, the first; a click checks the second.
  await page.keyboard.press('x');
  await rows.nth(1).getByRole('checkbox').click();
  await expect(bar.getByText('2 selected')).toBeVisible();
  await bar.getByRole('button', { name: 'Mark as done' }).click();

  await batch;
  await expect(bar).toBeHidden();
  await expect(page.locator('[data-slot="inbox-row"]')).toHaveCount(1);
  await expect
    .poll(async () => {
      const marks = (await (await owner.api.get('/api/v1/inbox/marks')).json()) as {
        itemKey: string;
        mark: string;
      }[];
      return marks.map((mark) => mark.mark);
    })
    .toEqual(['done', 'done']);
  const marked = (await (await owner.api.get('/api/v1/inbox/marks')).json()) as {
    itemKey: string;
  }[];
  expect(ids.filter((id) => marked.some((mark) => mark.itemKey === `approval:${id}`))).toHaveLength(
    2,
  );

  await owner.api.dispose();
});
