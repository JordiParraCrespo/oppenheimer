import { expect, test } from '@playwright/test';
import { insertPendingBotApproval } from '../../support/db';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * The Inbox in a browser, against the real control plane
 * (`product/versions/mvp/29-inbox.md`, `design/version1/Inbox.dc.html`): the
 * console lands on Plan's Inbox, a workspace with nothing waiting reads
 * "Nothing needs you", a bot's pending approval comes in as a mail row and as
 * the message in the reading pane, and Mark as done keeps the row under Show
 * done for the visit, stores the mark, and leaves the reader clear again.
 */
test('the Inbox: clear, an approval comes in, and Mark as done', async ({ page }) => {
  const owner = await provisionedUser('inbox');
  await signInAs(page, owner.user);

  await expect(page).toHaveURL(/\/plan\/inbox/);
  const plan = page.getByRole('navigation', { name: 'Plan' });
  await expect(plan.locator('[data-slot="routine-item"]', { hasText: 'Inbox' })).toHaveAttribute(
    'data-active',
    'true',
  );
  await expect(page.getByText('Nothing needs you', { exact: true })).toBeVisible();
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
  await expect(message.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
  await expect(message.getByRole('button', { name: 'Deny', exact: true })).toBeVisible();
  await expect(page.getByText('1 of 1', { exact: true })).toBeVisible();

  // The toolbar over the message marks it done.
  await page
    .getByRole('toolbar', { name: 'Item actions' })
    .getByRole('button', { name: 'Mark as done' })
    .click();

  await expect(page.getByText('Nothing needs you', { exact: true })).toBeVisible();
  // Show done keeps it for this visit, struck through.
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
  await expect(page.getByText('Nothing needs you', { exact: true })).toBeVisible();
  await expect(page.locator('[data-slot="inbox-item"]')).toHaveCount(0);

  // The address it had before it moved into Plan still opens it.
  await page.goto('/inbox');
  await expect(page).toHaveURL(/\/plan\/inbox/);

  await owner.api.dispose();
});

/**
 * Bulk actions (`29-inbox.md`, "Bulk actions"): checking rows swaps the
 * list's head for the selection bar, and Mark as done there marks every
 * checked row in one request, leaving the unchecked one in the list.
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
  await page.goto('/plan/inbox');
  const rows = page.locator('[data-slot="inbox-row"]');
  await expect(rows).toHaveCount(3);

  const batch = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/inbox/marks/batch'),
  );
  await rows.nth(0).hover();
  await rows.nth(0).getByRole('checkbox').click();
  await rows.nth(1).getByRole('checkbox').click();
  const bar = page.getByRole('toolbar', { name: 'Selected items' });
  await expect(bar.getByText('2 selected')).toBeVisible();
  await bar.getByRole('button', { name: 'Mark as done' }).click();

  await batch;
  await expect(bar).toBeHidden();
  await expect(page.locator('[data-slot="inbox-row"]:not(:has([data-done]))')).toHaveCount(1);
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
