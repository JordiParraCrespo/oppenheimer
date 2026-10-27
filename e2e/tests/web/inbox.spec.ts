import { expect, test } from '@playwright/test';
import { insertPendingBotApproval } from '../../support/db';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * The Inbox in a browser, against the real control plane
 * (`product/versions/mvp/29-inbox.md`, `design/version1/Brain.dc.html`): the
 * console lands on it, a workspace with nothing waiting reads "You're clear",
 * a bot's pending approval comes in as a row and as the card in the pane,
 * and Mark as done puts a line in the log, keeps the row under Show done for
 * the visit, stores the mark, and leaves the reader clear again.
 */
test('the Inbox: clear, an approval comes in, and Mark as done', async ({ page }) => {
  const owner = await provisionedUser('inbox');
  await signInAs(page, owner.user);

  const rail = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(rail.getByRole('link', { name: 'Inbox' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText("You're clear", { exact: true })).toBeVisible();
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
  await expect(
    page.getByText('Start a session on acme/app to fix the flaky login test.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Deny', exact: true })).toBeVisible();

  await row.hover();
  await page.getByRole('button', { name: 'Item actions' }).click();
  await page.getByRole('menuitem', { name: /Mark as done/ }).click();

  await expect(page.getByText('Marked done · Approve Ops · start_session')).toBeVisible();
  await expect(page.getByText("You're clear", { exact: true })).toBeVisible();
  // Show done keeps it for this visit, struck through.
  await expect(page.locator('[data-slot="inbox-item"][data-done]')).toHaveCount(1);

  // The mark is the server's: it is there after a reload, the log line is not.
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
  await expect(page.getByText("You're clear", { exact: true })).toBeVisible();
  await expect(page.getByText('Marked done · Approve Ops · start_session')).toHaveCount(0);

  await owner.api.dispose();
});
