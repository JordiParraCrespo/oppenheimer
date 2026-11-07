import { expect, type Locator, type Page, test } from '@playwright/test';
import {
  connectInstallation,
  createProject,
  createSession,
  pairHost,
} from '../../support/sessions';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Moving a session by dragging it: a row dropped in another project's group
 * is moved there, the same write as Move to project…, whether that group is
 * open or folded. A folded group draws no rows, so the carried row unmounts
 * as it crosses into one; the drop was lost there until the drag layer kept
 * the row's type for it.
 */

/** A pointer drag: past the drag layer's 5px start first, so the press is not a click. */
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

for (const folded of [false, true]) {
  test(`a session dragged into another ${folded ? 'folded ' : ''}project is moved there`, async ({
    page,
  }) => {
    test.slow();
    const owner = await provisionedUser('mover');
    const hostId = await pairHost(owner.api, 'Move box');
    const installationId = await connectInstallation(owner.api);
    const projectName = `Elsewhere ${folded ? 'folded' : 'open'} ${process.pid}`;
    const projectId = await createProject(owner.api, installationId, projectName);
    const sessionId = await createSession(owner.api, hostId, installationId);
    // A project with no session to draw is not drawn, so the target holds one.
    const stayId = await createSession(owner.api, hostId, installationId);
    const placed = await owner.api.post(`/api/v1/sessions/${stayId}/move`, {
      data: { projectId },
    });
    expect(placed.ok(), await placed.text()).toBe(true);
    const name = (
      (await (await owner.api.get(`/api/v1/sessions/${sessionId}`)).json()) as { name: string }
    ).name;

    await signInAs(page, owner.user);
    await page.goto('/sessions');
    const group = () =>
      page.locator('[data-slot="sortable-group"]').filter({ hasText: projectName });
    const header = () => group().getByText(projectName, { exact: true });
    const row = page.getByRole('link', { name, exact: true });
    await expect(row).toBeVisible();
    if (folded) await header().click();

    const answered = page.waitForResponse(
      (response) => response.url().endsWith(`/sessions/${sessionId}/move`) && response.ok(),
    );
    await drag(page, row, header);
    await answered;

    const after = (await (await owner.api.get(`/api/v1/sessions/${sessionId}`)).json()) as {
      projectId: string;
    };
    expect(after.projectId).toBe(projectId);
    if (folded) await header().click();
    await expect(group().getByRole('link', { name, exact: true })).toBeVisible();
  });
}
