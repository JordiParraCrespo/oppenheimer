import { expect, test } from '@playwright/test';
import { STUB_KEY_PREFIX } from '../../support/cursor-stub';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Settings → Agents decides which tabs New session's engine picker draws on
 * this device, Cursor's cloud agent among them once its key is saved (on the
 * Cursor stub, `support/cursor-stub.ts`). What breaks this: a Cursor tab the
 * page cannot switch off, or a switch that leaves a picker open in another
 * tab offering what was hidden.
 */
test('switching Cursor off in Settings takes its tab out of the open picker', async ({ page }) => {
  const owner = await provisionedUser('agentswitch');
  const put = await owner.api.put('/api/v1/cloud-agents/providers/cursor/credential', {
    data: { apiKey: `${STUB_KEY_PREFIX}9f3a` },
    failOnStatusCode: false,
  });
  expect(put.status(), await put.text()).toBe(200);
  await signInAs(page, owner.user);

  await page.goto('/sessions/new');
  await page.getByRole('button', { name: 'Agent and model' }).click();
  const tabs = page.getByRole('tablist', { name: 'Agent and model' });
  await expect(tabs.getByRole('tab', { name: 'Cursor' })).toBeVisible();

  const settings = await page.context().newPage();
  await settings.goto('/settings/agents');
  const cursor = settings.getByRole('switch', { name: 'Show Cursor in New session' });
  await expect(cursor).toBeChecked();
  await cursor.click();
  await expect(cursor).not.toBeChecked();

  await page.bringToFront();
  await expect(tabs).toBeVisible();
  await expect(tabs.getByRole('tab', { name: 'Cursor' })).toHaveCount(0);
  await expect(tabs.getByRole('tab', { name: 'Claude Code' })).toBeVisible();

  await settings.getByRole('switch', { name: 'Show Cursor in New session' }).click();
  await expect(tabs.getByRole('tab', { name: 'Cursor' })).toBeVisible();
  await owner.api.dispose();
});
