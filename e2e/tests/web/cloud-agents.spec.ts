import { expect, test } from '@playwright/test';
import { STUB_KEY_PREFIX } from '../../support/cursor-stub';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Cloud agents in a browser, on the Cursor stub (`support/cursor-stub.ts`):
 * the rail's Cloud agents sends a reader with no key to Settings, where the
 * key is connected through the dialog; then an agent is launched on Grok,
 * followed to the end on its page and in the sidebar, and given its next
 * instruction. The API's own spec covers the refusals; this holds the
 * console's wiring: the rail, the routes, the pickers and the poll.
 */
test('connects Cursor, launches an agent on Grok and follows it to the end', async ({ page }) => {
  test.setTimeout(90_000);
  const owner = await provisionedUser('cloud-web');
  await signInAs(page, owner.user);

  await page.getByRole('link', { name: 'Cloud agents', exact: true }).click();
  await expect(page).toHaveURL(/\/cloud$/);
  await page.getByRole('link', { name: 'Connect Cursor' }).click();
  await expect(page).toHaveURL(/\/settings\/cloud-agents$/);

  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.getByLabel('API key').fill(`${STUB_KEY_PREFIX}9f3a`);
  await page.getByRole('dialog').getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(page.getByText('Stub key · stub@cursor.test · ending 9f3a')).toBeVisible();

  await page.goto('/cloud');
  await page.getByLabel('What should it do?').fill('Fix the login redirect loop.');
  await page.getByRole('button', { name: 'Repository' }).click();
  await page.getByRole('option', { name: /acme\/api/ }).click();
  await page.getByRole('button', { name: 'Model' }).click();
  await page.getByRole('option', { name: 'Grok 4.7' }).click();
  await page.getByRole('button', { name: 'Launch agent' }).click();

  await expect(page).toHaveURL(/\/cloud\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'Fix the login redirect loop' })).toBeVisible();
  await expect(page.getByText('grok-4.7')).toBeVisible();
  // The sidebar lists it, and the page follows the run to its end.
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Fix the login redirect loop' }),
  ).toBeVisible();
  await expect(page.getByText('Finished', { exact: true })).toBeVisible({ timeout: 40_000 });
  await expect(page.getByText('cursor/fix-the-login-redirect-loop')).toBeVisible();

  await page.getByLabel('Next instruction').fill('Add a test for it.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Starting', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Next instruction')).toBeDisabled();

  await owner.api.dispose();
});
