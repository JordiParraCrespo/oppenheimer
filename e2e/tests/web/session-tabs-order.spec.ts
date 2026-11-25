import { expect, type Locator, type Page, test } from '@playwright/test';
import { connectInstallation, createSession, pairHost } from '../../support/sessions';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * The tabs over Sessions are dragged into the reader's own order, and the
 * order is kept on this device: a reload draws them where they were dropped.
 * A click on a tab still opens its session.
 */

/** Where `target` is drawn, asked again while Playwright answers it has no box yet. */
async function boxOf(target: Locator) {
  let box = await target.boundingBox();
  await expect
    .poll(async () => {
      box = await target.boundingBox();
      return box;
    })
    .not.toBeNull();
  if (!box) throw new Error('nothing drawn');
  return box;
}

/** A pointer drag along the strip: past the drag layer's 5px start first, so the press is not a click. */
async function drag(page: Page, from: Locator, to: Locator) {
  const start = await boxOf(from);
  const target = await boxOf(to);
  const y = start.y + start.height / 2;
  await page.mouse.move(start.x + start.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 - 10, y, { steps: 5 });
  await page.mouse.move(target.x + 8, y, { steps: 15 });
  await page.mouse.up();
}

test('a tab dragged to the front of the strip stays there after a reload', async ({ page }) => {
  test.slow();
  const owner = await provisionedUser('tabs');
  const hostId = await pairHost(owner.api, 'Tabs box');
  const installationId = await connectInstallation(owner.api);
  const ids = [
    await createSession(owner.api, hostId, installationId),
    await createSession(owner.api, hostId, installationId),
    await createSession(owner.api, hostId, installationId),
  ];
  const names = await Promise.all(
    ids.map(
      async (id) =>
        ((await (await owner.api.get(`/api/v1/sessions/${id}`)).json()) as { name: string }).name,
    ),
  );

  await signInAs(page, owner.user);
  const strip = page.locator('[data-slot="chat-tab-strip"]');
  const tab = (name: string) => strip.locator('[data-slot="chat-tab"]').filter({ hasText: name });
  for (const [at, id] of ids.entries()) {
    await page.goto(`/sessions/${id}`);
    // Its tab is kept once the page has drawn it; the next page opens on top of that.
    await expect(tab(names[at])).toBeVisible();
  }
  const order = () => strip.locator('[data-slot="chat-tab"]').allInnerTexts();
  await expect.poll(order).toEqual(names);

  await drag(page, tab(names[2]), tab(names[0]));
  await expect.poll(order).toEqual([names[2], names[0], names[1]]);
  // The drop leaves the page where it was: the dragged tab is the one on screen.
  await expect(page).toHaveURL(new RegExp(`/sessions/${ids[2]}$`));

  await page.reload();
  await expect.poll(order).toEqual([names[2], names[0], names[1]]);

  await tab(names[0]).getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`/sessions/${ids[0]}$`));
  await expect.poll(order).toEqual([names[2], names[0], names[1]]);
});
