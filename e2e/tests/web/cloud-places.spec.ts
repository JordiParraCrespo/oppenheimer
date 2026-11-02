import { expect, type Page, test } from '@playwright/test';
import { STUB_KEY_PREFIX } from '../../support/cursor-stub';
import { connectInstallation, createProject, pairHost } from '../../support/sessions';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Cloud sessions from Plan's tasks and from automations, on the Cursor stub
 * (`support/cursor-stub.ts`): Start session's Where chip launches the task at
 * Cursor with no host, and an automation set to run in Cursor launches its
 * run there on its owner's key (`product/next-steps/cloud-agents.md`, "Tasks
 * and automations"). Claude Code's cloud needs a runner that can start it,
 * which the fleet suites have and this one does not.
 */

async function connectCursor(api: Awaited<ReturnType<typeof provisionedUser>>['api']) {
  const put = await api.put('/api/v1/cloud-agents/providers/cursor/credential', {
    data: { apiKey: `${STUB_KEY_PREFIX}9f3a` },
    failOnStatusCode: false,
  });
  expect(put.status(), await put.text()).toBe(200);
}

function card(page: Page, title: string) {
  return page.locator('[data-slot="task-card"]').filter({ hasText: title });
}

test('a task starts in Cursor’s cloud, with no host, and links the session', async ({ page }) => {
  test.slow();
  const owner = await provisionedUser('cloudtask');
  await pairHost(owner.api, 'Plan box');
  const installationId = await connectInstallation(owner.api);
  await createProject(owner.api, installationId, 'Wallet');
  await connectCursor(owner.api);
  await signInAs(page, owner.user);
  await page.goto('/plan');

  await page.getByRole('button', { name: 'New task', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New task' });
  await dialog.getByLabel('Title').fill('Fix the login redirect loop');
  await dialog.getByRole('button', { name: 'Wallet' }).click();
  await dialog.getByRole('button', { name: 'Add task' }).click();

  await card(page, 'Fix the login redirect loop').hover();
  await card(page, 'Fix the login redirect loop')
    .getByRole('button', { name: 'Start session' })
    .click();
  const start = page.getByRole('dialog', { name: 'Start session' });
  await start.getByRole('button', { name: 'Where it runs' }).click();
  await page.getByRole('option', { name: /^Cursor/ }).click();
  // No host and no agent of ours at a vendor: Cursor runs its own.
  await expect(start.getByRole('button', { name: 'Host' })).toHaveCount(0);
  await expect(start.getByRole('button', { name: 'Agent and model' })).toHaveCount(0);

  // A cloud session starts on a task.
  await start.getByLabel('Prompt').fill('');
  await expect(start.getByText('A cloud session starts on a task')).toBeVisible();
  await expect(start.getByRole('button', { name: 'Start session' })).toBeDisabled();
  await start.getByLabel('Prompt').fill('Fix the login redirect loop');
  await start.getByRole('button', { name: 'Start session' }).click();
  await expect(start).toBeHidden();

  const line = page
    .locator('[data-slot="task-card"]')
    .filter({ hasText: 'Fix the login redirect loop' })
    .getByRole('button', { name: /^Open session / });
  await expect(line).toBeVisible();
  await owner.api.dispose();
});

test('an automation runs in Cursor’s cloud on its owner’s key', async ({ page }) => {
  test.slow();
  const owner = await provisionedUser('cloudauto');
  await pairHost(owner.api, 'E2E box');
  const installationId = await connectInstallation(owner.api);
  await createProject(owner.api, installationId, 'XRP Mobile');
  await connectCursor(owner.api);
  await signInAs(page, owner.user);
  await page.goto('/automations');

  await page.getByRole('button', { name: 'New automation', exact: true }).first().click();
  const editor = page.getByRole('dialog', { name: 'New automation' });
  await editor.getByLabel('Name').fill('Nightly audit');
  await editor.getByLabel('What should the agent do?').fill('Audit the manifests.');
  await editor.getByRole('button', { name: 'Next' }).click();
  await editor.getByRole('button', { name: 'Add trigger' }).click();
  await page.getByRole('menuitem', { name: /^Weekdays/ }).click();
  await editor.getByRole('button', { name: 'Next' }).click();

  // Runs in: Cursor, which has no host or agent to pick.
  await editor.getByRole('button', { name: 'Runs in' }).click();
  await page.getByRole('option', { name: /^Cursor/ }).click();
  await expect(editor.getByRole('button', { name: 'Runs in' })).toContainText('Cursor');
  await expect(editor.getByRole('button', { name: 'Host' })).toHaveCount(0);
  await expect(editor.getByRole('button', { name: 'Agent' })).toHaveCount(0);
  await editor.getByRole('button', { name: 'Create automation' }).click();
  await expect(editor).toHaveCount(0);

  const row = page.getByRole('row', { name: 'Nightly audit' });
  await expect(row).toContainText('Cursor');
  await row.click();
  await page.getByRole('button', { name: 'Run now' }).click();
  // The run is launched at the vendor: a session with Cursor's mark.
  const run = page.getByRole('row').filter({ hasText: 'Nightly audit' }).last();
  await expect(run).toBeVisible({ timeout: 20_000 });
  await run.click();
  await expect(page).toHaveURL(/\/automations\/[0-9a-f-]{36}\/sessions\/[0-9a-f-]{36}$/);
  await owner.api.dispose();
});
