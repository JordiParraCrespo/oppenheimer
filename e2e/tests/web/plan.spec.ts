import { expect, type Page, test } from '@playwright/test';
import { connectInstallation, createProject, pairHost } from '../../support/sessions';
import { provisionedUser, signInAs } from '../../support/web';

/** A board column, by its heading. */
const column = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
/** A card on the board, by its title. */
const card = (page: Page, title: string) =>
  page.locator('[data-card]').filter({ has: page.getByText(title, { exact: true }) });

/**
 * Plan, in a browser, against the real control plane
 * (`product/versions/mvp/17-plan.md`): the rail's third list, a task's life on
 * the board — added from the dialog and inline, dragged across columns,
 * ticked done, filed under a goal, deleted — and a session started from a
 * card, which moves it to In progress and links back from the session.
 * Only GitHub is faked; the host has no runner, so the session is queued.
 */
test('a task from the dialog to deletion, across the board', async ({ page }) => {
  test.slow();
  const owner = await provisionedUser('plan');
  await signInAs(page, owner.user);
  await page.goto('/sessions');

  await page.getByRole('link', { name: 'Plan', exact: true }).click();
  await expect(page).toHaveURL(/\/plan$/);
  for (const name of ['Later', 'To do', 'In progress', 'Done']) {
    await expect(column(page, name)).toBeVisible();
  }
  await expect(page.getByText('No goals yet.')).toBeVisible();

  // New task: the dialog, with a due date.
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New task' });
  await dialog.getByLabel('Title').fill('Ship the wallet list');
  await dialog.getByRole('button', { name: 'Add task' }).click();
  await expect(dialog).toBeHidden();
  await expect(column(page, 'To do').getByText('Ship the wallet list')).toBeVisible();
  await expect(page.getByText('1 open · 0 in progress · 0 done')).toBeVisible();

  // Inline: Enter adds and stays open for the next.
  await column(page, 'Later').getByRole('button', { name: 'Add task', exact: true }).click();
  const quick = column(page, 'Later').getByPlaceholder('Task title');
  await quick.fill('Write the release notes');
  await quick.press('Enter');
  await expect(column(page, 'Later').getByText('Write the release notes')).toBeVisible();
  await quick.press('Escape');

  // Drag a card into In progress; it stays there after a reload.
  await card(page, 'Write the release notes').dragTo(
    column(page, 'In progress').locator('[data-col]'),
  );
  await expect(column(page, 'In progress').getByText('Write the release notes')).toBeVisible();
  await page.reload();
  await expect(column(page, 'In progress').getByText('Write the release notes')).toBeVisible();

  // Tick done, and back.
  await card(page, 'Ship the wallet list').getByRole('button', { name: 'Mark as done' }).click();
  await expect(column(page, 'Done').getByText('Ship the wallet list')).toBeVisible();
  await card(page, 'Ship the wallet list')
    .getByRole('button', { name: 'Mark as not done' })
    .click();
  await expect(column(page, 'To do').getByText('Ship the wallet list')).toBeVisible();

  // A goal, and a task filed under it; the goal filters the board.
  await page.getByRole('button', { name: 'New goal', exact: true }).click();
  const goal = page.getByRole('dialog', { name: 'New goal' });
  await goal.getByLabel('Goal').fill('Wallet 2.0');
  await goal.getByRole('button', { name: 'Add goal' }).click();
  await expect(goal).toBeHidden();
  await card(page, 'Ship the wallet list').click();
  const edit = page.getByRole('dialog', { name: 'Edit task' });
  await edit.getByRole('button', { name: 'Wallet 2.0' }).click();
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(edit).toBeHidden();
  await expect(page.getByText('0 / 1 tasks')).toBeVisible();
  await page
    .getByRole('button', { name: /^Wallet 2\.0/ })
    .first()
    .click();
  await expect(page).toHaveURL(/goal=/);
  await expect(card(page, 'Write the release notes')).toHaveCount(0);
  await expect(card(page, 'Ship the wallet list')).toBeVisible();

  // Delete, behind a confirmation.
  await card(page, 'Ship the wallet list').click();
  await page
    .getByRole('dialog', { name: 'Edit task' })
    .getByRole('button', { name: 'Delete task' })
    .click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete task' }).click();
  await expect(card(page, 'Ship the wallet list')).toHaveCount(0);
  await owner.api.dispose();
});

test('a session started from a card moves it to In progress and links back', async ({ page }) => {
  test.slow();
  const owner = await provisionedUser('plansession');
  await pairHost(owner.api, 'Plan box');
  const installationId = await connectInstallation(owner.api);
  await createProject(owner.api, installationId, 'Wallet');
  await signInAs(page, owner.user);
  await page.goto('/plan');

  await page.getByRole('button', { name: 'New task', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New task' });
  await dialog.getByLabel('Title').fill('Fix the empty state');
  await dialog.getByRole('button', { name: 'Wallet' }).click();
  await dialog.getByRole('button', { name: 'Add task' }).click();
  await expect(column(page, 'To do').getByText('Fix the empty state')).toBeVisible();

  await card(page, 'Fix the empty state').hover();
  await card(page, 'Fix the empty state').getByRole('button', { name: 'Start session' }).click();
  const start = page.getByRole('dialog', { name: 'Start session' });
  await expect(start.getByText('For “Fix the empty state”')).toBeVisible();
  await expect(start.getByLabel('Prompt')).toHaveValue('Fix the empty state');
  // The host has no runner: the session waits for it.
  await expect(start.getByText(/Plan box (is offline|has been offline)/)).toBeVisible();
  await start.getByRole('button', { name: 'Queue session' }).click();
  await expect(start).toBeHidden();

  const moved = column(page, 'In progress');
  await expect(
    moved.locator('[data-card]').filter({ hasText: 'Fix the empty state' }),
  ).toBeVisible();
  const line = moved.getByRole('button', { name: /^Open session / });
  await expect(line).toContainText('Queued');
  await line.click();
  await expect(page).toHaveURL(/\/sessions\//);
  await owner.api.dispose();
});

test('the calendar: a personal event on a day, and the layers', async ({ page }) => {
  const owner = await provisionedUser('plancalendar');
  await signInAs(page, owner.user);
  await page.goto('/plan/calendar');

  await expect(page.getByRole('navigation', { name: 'Plan' }).locator('[data-active]')).toHaveText(
    'Calendar',
  );
  await page.getByRole('button', { name: 'New event', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New event' });
  await dialog.getByLabel('Title').fill('Design review');
  await dialog.getByRole('button', { name: 'Add event' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: /Design review/ })).toBeVisible();

  await page.getByRole('checkbox', { name: 'My events' }).click();
  await expect(page).toHaveURL(/off=events/);
  await expect(page.getByRole('button', { name: /Design review/ })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'My events' }).click();
  await expect(page.getByRole('button', { name: /Design review/ })).toBeVisible();
  await owner.api.dispose();
});
