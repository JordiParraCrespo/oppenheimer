import { expect, type Page, test } from '@playwright/test';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * The bots' one order, in a browser, against the real control plane
 * (`product/versions/mvp/28-bots-in-sections.md`): a section's Bots heading
 * lists its bots in the Employees order, groups first, and a bot dragged
 * there from the keyboard (Space, an arrow, Space) is saved as its place in
 * Employees, which a reload, every other heading and the bots read then draw.
 */

const BOTS = ['Ada', 'Bea', 'Cy'];

/** The bots a section's Bots heading draws, top to bottom, by name (a row leads with initials). */
const names = (page: Page) =>
  page
    .getByRole('region', { name: 'Bots' })
    .locator('[data-slot="bot-item"]')
    .allInnerTexts()
    .then((rows) => rows.map((row) => BOTS.find((name) => row.split('\n').includes(name))));

test('a bot dragged under a section’s Bots heading moves there and in Employees', async ({
  page,
}) => {
  const owner = await provisionedUser('bot-order');
  const group = await (
    await owner.api.post('/api/v1/bot-groups', { data: { name: 'Release' } })
  ).json();
  for (const [name, groupId] of [
    ['Ada', null],
    ['Bea', null],
    ['Cy', group.id],
  ] as const) {
    const made = await owner.api.post('/api/v1/bots', {
      data: { name, provider: 'anthropic', sections: ['pulls', 'sessions'] },
    });
    expect(made.ok()).toBe(true);
    if (groupId) {
      const { id } = await made.json();
      await owner.api.patch(`/api/v1/bots/${id}`, { data: { groupId } });
    }
  }
  await signInAs(page, owner.user);

  // The heading draws Employees' order: the group's bot first, then Ungrouped.
  await page.goto('/pulls');
  const heading = page.getByRole('region', { name: 'Bots' });
  await expect(heading.getByRole('link', { name: /Bea/ })).toBeVisible();
  expect(await names(page)).toEqual(['Cy', 'Ada', 'Bea']);

  // Bea picked up from the keyboard and put above Ada.
  await heading.getByRole('link', { name: /Bea/ }).focus();
  await page.keyboard.press('Space');
  await expect(heading.locator('[data-dragging]')).toHaveCount(1);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Space');
  await expect.poll(() => names(page)).toEqual(['Cy', 'Bea', 'Ada']);
  // The drop did not open the chat: Space is not Enter.
  await expect(page).toHaveURL(/\/pulls$/);

  // Saved: a reload, another section and the list Employees reads keep it.
  await page.reload();
  await expect.poll(() => names(page)).toEqual(['Cy', 'Bea', 'Ada']);
  await page.goto('/sessions');
  await expect.poll(() => names(page)).toEqual(['Cy', 'Bea', 'Ada']);
  const listed = await (await owner.api.get('/api/v1/bots')).json();
  expect(listed.map((bot: { name: string }) => bot.name)).toEqual(['Cy', 'Bea', 'Ada']);
});
