import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Settings → About, in a browser: the row in Settings' nav opens it, and it
 * shows the version the console was built with beside the one the running API
 * answers at `GET /health/version`, read with the signed-in session. Each is
 * checked against its own `package.json`, so a row reading the other side's
 * version, or the API row never landing, fails here.
 */
function versionOf(app: 'web' | 'api'): string {
  const path = new URL(`../../../apps/${app}/package.json`, import.meta.url);
  return (JSON.parse(readFileSync(path, 'utf8')) as { version: string }).version;
}

test('About shows the console and API versions', async ({ page }) => {
  const owner = await provisionedUser('settings-about');
  await signInAs(page, owner.user);
  await page.goto('/settings/profile');

  await page.getByRole('link', { name: 'About' }).click();
  await expect(page).toHaveURL(/\/settings\/about$/);
  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();

  const row = (label: string) =>
    page.locator('[data-slot="settings-row"]').filter({ hasText: label });
  await expect(row('The web app running in this tab.')).toContainText(versionOf('web'));
  await expect(row('The control plane this console talks to.')).toContainText(versionOf('api'));

  await owner.api.dispose();
});
