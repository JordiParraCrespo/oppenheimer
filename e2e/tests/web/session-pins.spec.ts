import { expect, type Locator, type Page, test } from '@playwright/test';
import { connectInstallation, createSession, pairHost } from '../../support/sessions';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Pinning a session by dragging it: a row dropped on Pinned is pinned, and
 * shown there before anything is pinned while a row is carried; a pinned row
 * dragged back into its project is unpinned. A reload keeps the pin.
 */

/** A pointer drag with a hold in the middle, the way a hand does it: past the 5px start, then on. */
async function drag(page: Page, from: Locator, to: () => Locator) {
  const start = await from.boundingBox();
  if (!start) throw new Error('nothing to drag');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2 + 10, { steps: 5 });
  const target = await to().boundingBox();
  if (!target) throw new Error('nowhere to drop');
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 10 });
  await page.mouse.up();
}

test('a session dragged onto Pinned is pinned, and dragged back out is not', async ({ page }) => {
  test.slow();
  const owner = await provisionedUser('pinner');
  const hostId = await pairHost(owner.api, 'Pin box');
  const installationId = await connectInstallation(owner.api);
  const ids = [
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
  await page.goto('/sessions');
  const row = (name: string) => page.getByRole('link', { name, exact: true });
  const pinned = () => page.locator('[data-slot="sortable-group"]').filter({ hasText: 'Pinned' });
  await expect(row(names[0])).toBeVisible();
  await expect(page.getByText('Pinned', { exact: true })).toHaveCount(0);

  await drag(page, row(names[0]), () => page.getByText('Drop a session here to pin it.'));
  await expect(pinned().getByRole('link', { name: names[0], exact: true })).toBeVisible();

  await page.reload();
  await expect(pinned().getByRole('link', { name: names[0], exact: true })).toBeVisible();

  await drag(page, row(names[0]), () => row(names[1]));
  await expect(page.getByText('Pinned', { exact: true })).toHaveCount(0);
  await expect(row(names[0])).toBeVisible();
});
