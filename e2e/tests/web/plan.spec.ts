import { expect, type Locator, type Page, test } from '@playwright/test';
import { connectInstallation, createProject, pairHost } from '../../support/sessions';
import { provisionedUser, signInAs } from '../../support/web';

const STATUS = { Later: 'later', 'To do': 'todo', 'In progress': 'doing', Done: 'done' } as const;
/** A board column, by its heading. */
const column = (page: Page, name: keyof typeof STATUS) =>
  page.locator(`[data-slot="task-column"][data-status="${STATUS[name]}"]`);
/** A card on the board, by its title. */
const card = (page: Page, title: string) =>
  page.locator('[data-slot="task-card"]').filter({ has: page.getByText(title, { exact: true }) });

/** Drag on the drag layer: press, pass its 5px threshold, glide over, let go. */
async function drag(page: Page, from: Locator, to: Locator) {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  if (!a || !b) throw new Error('nothing to drag');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 8, a.y + a.height / 2 + 8, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
}

/**
 * Plan, in a browser, against the real control plane
 * (`product/versions/mvp/17-plan.md`): the rail's third list, a task's life on
 * the board — added from the dialog and inline, dragged across columns,
 * ticked done, filed under a milestone (made on the Milestones view, where it
 * lies on the timeline), deleted — and a session started from a card,
 * which moves it to In progress and links back from the session.
 * Only GitHub is faked; the host has no runner, so the session is queued.
 */
/** A row of Plan's sidebar head: Tasks, Milestones, Calendar. */
function planNav(page: Page, name: string) {
  return page.getByRole('navigation', { name: 'Plan' }).getByText(name, { exact: true });
}

test('a task from the dialog to deletion, across the board', async ({ page }) => {
  test.slow();
  const owner = await provisionedUser('plan');
  await signInAs(page, owner.user);
  await page.goto('/sessions');

  await page.getByRole('link', { name: 'Plan', exact: true }).click();
  await expect(page).toHaveURL(/\/plan$/);
  for (const name of ['Later', 'To do', 'In progress', 'Done'] as const) {
    await expect(column(page, name)).toBeVisible();
  }

  // New task: the dialog, with a due date.
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New task' });
  await dialog.getByLabel('Title').fill('Ship the wallet list');
  await dialog.getByRole('button', { name: 'Add task' }).click();
  await expect(dialog).toBeHidden();
  await expect(column(page, 'To do').getByText('Ship the wallet list')).toBeVisible();
  await expect(page.getByText('1 open')).toBeVisible();

  // Inline: Enter adds and stays open for the next.
  await column(page, 'Later').getByRole('button', { name: 'Add task', exact: true }).click();
  const quick = column(page, 'Later').getByRole('textbox', { name: 'Task title' });
  await quick.fill('Write the release notes');
  await quick.press('Enter');
  await expect(column(page, 'Later').getByText('Write the release notes')).toBeVisible();
  await quick.press('Escape');

  // Drag a card into In progress; it stays there after a reload.
  await drag(
    page,
    card(page, 'Write the release notes'),
    column(page, 'In progress').locator('[data-slot="task-column-add"]'),
  );
  await expect(column(page, 'In progress').getByText('Write the release notes')).toBeVisible();
  await page.reload();
  await expect(column(page, 'In progress').getByText('Write the release notes')).toBeVisible();

  // Tick done, and back.
  await card(page, 'Ship the wallet list').getByRole('checkbox', { name: 'Mark as done' }).click();
  await expect(column(page, 'Done').getByText('Ship the wallet list')).toBeVisible();
  await card(page, 'Ship the wallet list')
    .getByRole('checkbox', { name: 'Mark as not done' })
    .click();
  await expect(column(page, 'To do').getByText('Ship the wallet list')).toBeVisible();

  // A milestone, made on the Milestones view, and a task filed under it; the
  // board's milestone facet filters to it.
  await planNav(page, 'Milestones').click();
  await expect(page).toHaveURL(/\/plan\/milestones/);
  await expect(page.getByText('No milestones for this project')).toBeVisible();
  await page.getByRole('button', { name: 'New milestone', exact: true }).click();
  const milestone = page.getByRole('dialog', { name: 'New milestone' });
  await milestone.getByLabel('Milestone').fill('Wallet 2.0');
  await milestone.locator('[data-slot="date-picker"]').click();
  await page.getByRole('button', { name: 'End of month' }).click();
  await milestone.getByRole('button', { name: 'Add milestone' }).click();
  await expect(milestone).toBeHidden();
  // On the timeline: the project's track with the milestone's diamond.
  const timeline = page.locator('[data-slot="milestone-timeline"]');
  await expect(timeline.getByLabel('Wallet 2.0', { exact: true })).toBeVisible();
  await planNav(page, 'Tasks').click();
  await card(page, 'Ship the wallet list').click();
  const edit = page.getByRole('dialog', { name: 'Edit task' });
  await edit.getByRole('button', { name: 'Wallet 2.0' }).click();
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(edit).toBeHidden();
  await page.getByRole('button', { name: 'Milestone' }).click();
  await page.getByRole('menuitemradio', { name: /Wallet 2\.0/ }).click();
  await expect(page).toHaveURL(/milestone=/);
  await expect(card(page, 'Write the release notes')).toHaveCount(0);
  await expect(card(page, 'Ship the wallet list')).toBeVisible();

  // The timeline counts it: the milestone's card on hover, 0% of one task.
  await planNav(page, 'Milestones').click();
  await timeline.getByLabel('Wallet 2.0', { exact: true }).hover();
  await expect(timeline.getByText('of 1 task')).toBeVisible();
  await planNav(page, 'Tasks').click();

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
    moved.locator('[data-slot="task-card"]').filter({ hasText: 'Fix the empty state' }),
  ).toBeVisible();
  const line = moved.getByRole('button', { name: /^Open session / });
  await expect(line).toContainText('Queued');

  // Link existing: a pane under the button in the task's dialog, the task's
  // project's sessions under its name; Enter links the first and the task
  // moves to In progress.
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  const second = page.getByRole('dialog', { name: 'New task' });
  await second.getByLabel('Title').fill('Polish the wallet list');
  await second.getByRole('button', { name: 'Wallet' }).click();
  await second.getByRole('button', { name: 'Add task' }).click();
  await card(page, 'Polish the wallet list').click();
  const edit = page.getByRole('dialog', { name: 'Edit task' });
  await edit.getByRole('button', { name: 'Link existing' }).click();
  const pane = page.getByRole('listbox', { name: 'Search sessions' });
  await expect(pane.getByText('In Wallet')).toBeVisible();
  await expect(pane.getByRole('option')).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Search sessions' }).press('Enter');
  await expect(pane).toBeHidden();
  await expect(edit.getByRole('button', { name: /^Unlink / })).toHaveCount(1);
  await edit.press('Escape');
  await expect(
    moved.locator('[data-slot="task-card"]').filter({ hasText: 'Polish the wallet list' }),
  ).toBeVisible();

  // Both cards carry that one session now.
  await line.first().click();
  await expect(page).toHaveURL(/\/sessions\//);
  await owner.api.dispose();
});

test('the calendar: a personal event on a day, and the layers', async ({ page }) => {
  const owner = await provisionedUser('plancalendar');
  await signInAs(page, owner.user);
  const plan = page.getByRole('navigation', { name: 'Plan' });
  const layer = page.getByRole('checkbox', { name: 'Personal' });

  // Into the board through the sidebar from a calendar opened cold, with the
  // board's chunk (the dev server's module, which the stack serves) held back
  // and a layer toggled while it is on its way. The
  // calendar stays matched until the board can draw, so the toggle is a real
  // one and the later choice wins; the next move lands on the board, whose
  // list must take over from the calendar's without ever drawing it unmatched.
  await page.goto('/plan/calendar');
  await expect(page.getByRole('button', { name: 'New event', exact: true })).toBeVisible();
  await page.route(/\/plan\/index\.tsx/, async (route) => {
    await new Promise((settle) => setTimeout(settle, 1_500));
    await route.continue();
  });
  await plan.getByText('Tasks', { exact: true }).click();
  await layer.click();
  await expect(page).toHaveURL(/off=events/);
  await plan.getByText('Tasks', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'New task', exact: true })).toBeVisible();
  await page.unroute(/\/plan\/index\.tsx/);

  // And back to the calendar the same way.
  await plan.getByText('Calendar', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'New event', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New event', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New event' });
  await dialog.getByLabel('Title').fill('Design review');
  await dialog.getByRole('button', { name: 'Add event' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: /Design review/ })).toBeVisible();

  await layer.click();
  await expect(page).toHaveURL(/off=events/);
  await expect(page.getByRole('button', { name: /Design review/ })).toHaveCount(0);
  await layer.click();
  await expect(page.getByRole('button', { name: /Design review/ })).toBeVisible();
  await owner.api.dispose();
});

test('the calendar: a Google meeting joins from its dialog, an event without one does not offer it', async ({
  page,
}) => {
  const owner = await provisionedUser('plangooglejoin');
  await signInAs(page, owner.user);
  // The stack has no Google account behind it, so the two Google reads are
  // answered here, in the shape the API serves; which link the API picks is
  // its own unit spec (`google-calendar-event.util.spec.ts`).
  const connectionId = '11111111-1111-4111-8111-111111111111';
  const today = new Date().toLocaleDateString('en-CA');
  const event = (id: string, title: string, meetingUrl: string | null) => ({
    id,
    connectionId,
    source: 'google',
    title,
    notes: '',
    date: today,
    allDay: false,
    startTime: '10:00',
    endTime: '10:30',
    busy: true,
    url: `https://calendar.google.com/event?eid=${id}`,
    meetingUrl,
  });
  await page.route('**/v1/calendar/google/connections', (route) =>
    route.fulfill({
      json: [
        {
          id: connectionId,
          accountEmail: 'ana@example.com',
          status: 'active',
          colorIndex: 0,
          connectedAt: '2026-10-01T09:00:00Z',
        },
      ],
    }),
  );
  await page.route('**/v1/calendar/google/events?**', (route) =>
    route.fulfill({
      json: {
        events: [
          event('standup', 'Team standup', 'https://acme.zoom.us/j/123'),
          event('focus', 'Focus time', null),
        ],
        accounts: [{ id: connectionId, status: 'ok' }],
      },
    }),
  );

  await page.goto('/plan/calendar');
  await page.getByRole('button', { name: /Team standup/ }).click();
  const meeting = page.getByRole('dialog', { name: 'Team standup' });
  const join = meeting.getByRole('link', { name: 'Join meeting' });
  await expect(join).toHaveAttribute('href', 'https://acme.zoom.us/j/123');
  await expect(join).toHaveAttribute('target', '_blank');
  await expect(meeting.getByRole('link', { name: 'Open in Google Calendar' })).toBeVisible();
  await meeting.getByRole('button', { name: 'Close' }).click();
  await expect(meeting).toBeHidden();

  await page.getByRole('button', { name: /Focus time/ }).click();
  const focus = page.getByRole('dialog', { name: 'Focus time' });
  await expect(focus.getByRole('link', { name: 'Open in Google Calendar' })).toBeVisible();
  await expect(focus.getByRole('link', { name: 'Join meeting' })).toHaveCount(0);
  await owner.api.dispose();
});
