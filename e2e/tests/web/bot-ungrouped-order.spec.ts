import { expect, type Page, test } from '@playwright/test';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Ungrouped in the Employees sidebar drags among the groups like one of
 * them: picked up by its head from the keyboard (Space on its fold button,
 * an arrow, Space), it is drawn where it was dropped, and a reload keeps
 * that place, which lives on this device. Before, it was always last and
 * did not move.
 */

/** The sections' heads in the sidebar, top to bottom. */
const heads = (page: Page) =>
  page
    .locator('[data-slot="sidebar-project-header"]')
    .allInnerTexts()
    .then((rows) => rows.map((row) => row.split('\n')[0]?.trim().toLowerCase()));

test('Ungrouped dragged above a group stays there across a reload', async ({ page }) => {
  const owner = await provisionedUser('bot-ungrouped-order');
  const groupIds: string[] = [];
  for (const name of ['Alpha', 'Beta']) {
    const made = await owner.api.post('/api/v1/bot-groups', { data: { name } });
    expect(made.ok()).toBe(true);
    groupIds.push((await made.json()).id);
  }
  for (const [name, groupId] of [
    ['Ada', groupIds[0]],
    ['Bea', groupIds[1]],
    ['Cy', null],
  ] as const) {
    const made = await owner.api.post('/api/v1/bots', {
      data: { name, provider: 'anthropic', sections: ['sessions'] },
    });
    expect(made.ok()).toBe(true);
    if (groupId) {
      const { id } = await made.json();
      await owner.api.patch(`/api/v1/bots/${id}`, { data: { groupId } });
    }
  }
  await signInAs(page, owner.user);
  await page.goto('/bots');

  await expect.poll(() => heads(page)).toEqual(['alpha', 'beta', 'ungrouped']);

  const ungrouped = page
    .locator('[data-slot="sidebar-project-header"]')
    .filter({ hasText: 'Ungrouped' })
    .getByRole('button')
    .first();
  await ungrouped.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('[data-dragging]')).toHaveCount(1);
  await page.keyboard.press('ArrowUp');
  await expect(page.getByText(/Ungrouped is over Beta/)).toBeAttached();
  await page.keyboard.press('Space');
  await expect.poll(() => heads(page)).toEqual(['alpha', 'ungrouped', 'beta']);

  await page.reload();
  await expect.poll(() => heads(page)).toEqual(['alpha', 'ungrouped', 'beta']);
  // The groups' own order on the server did not move.
  const groups = await (await owner.api.get('/api/v1/bot-groups')).json();
  expect(groups.map((group: { name: string }) => group.name)).toEqual(['Alpha', 'Beta']);
});
