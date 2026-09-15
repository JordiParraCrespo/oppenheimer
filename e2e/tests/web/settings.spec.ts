import { expect, type Page, test } from '@playwright/test';
import { ORGANIZATION_NAME, provisionedUser, reloadFromServer, signInAs } from '../../support/web';

/**
 * The workspace settings screen, end to end.
 *
 * Every assertion goes through the real API: a save is followed by a reload, so
 * a test only passes if the value came back from the server rather than from
 * the component state that wrote it.
 */

/** The settings sub-nav, addressed by its accessible name. */
function sectionNav(page: Page) {
  return page.getByRole('navigation', { name: 'Settings sections' });
}

async function openSection(page: Page, label: string) {
  await sectionNav(page).getByRole('button', { name: label, exact: true }).click();
  await expect(page).toHaveURL(/section=/);
}

async function openSettings(page: Page) {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
}

test('opens on General and lists every section', async ({ page }) => {
  const { user, api } = await provisionedUser('settings');
  await signInAs(page, user);
  await openSettings(page);

  const nav = sectionNav(page);
  for (const label of ['General', 'Security', 'API & webhooks']) {
    await expect(nav.getByRole('button', { name: label, exact: true })).toBeVisible();
  }

  await expect(page.getByRole('heading', { name: 'General', level: 2 })).toBeVisible();
  await expect(page.getByLabel('Organisation name')).toHaveValue(ORGANIZATION_NAME, {
    timeout: 20_000,
  });

  await api.dispose();
});

test('a section is deep-linkable', async ({ page }) => {
  const { user, api } = await provisionedUser('settingslink');
  await signInAs(page, user);

  await page.goto('/settings?section=security');

  await expect(page.getByRole('heading', { name: 'Security', level: 2 })).toBeVisible();
  await expect(page).toHaveURL(/section=security/);

  await api.dispose();
});

test('survives a warm start with a persisted query cache', async ({ page }) => {
  // Regression guard: the profile/session entities carry behaviour and Date
  // values that do not survive the JSON round-trip into local storage.
  // Restored as plain objects, the session date made Intl throw "Invalid time
  // value", so these queries are kept out of the persisted cache.
  const { user, api } = await provisionedUser('settingswarm');
  await signInAs(page, user);

  await page.goto('/settings?section=security');
  await expect(page.getByRole('heading', { name: 'Security', level: 2 })).toBeVisible();
  await expect(page.getByText('This device')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Security', level: 2 })).toBeVisible();
  await expect(page.getByText('This device')).toBeVisible();
  await expect(page.getByText('Something went wrong!')).toBeHidden();

  await api.dispose();
});

test('General renames the workspace, and the sidebar follows', async ({ page }) => {
  const { user, api } = await provisionedUser('settingsname');
  await signInAs(page, user);
  await openSettings(page);

  await expect(page.getByLabel('Organisation name')).toHaveValue(ORGANIZATION_NAME, {
    timeout: 20_000,
  });
  const nextName = `${ORGANIZATION_NAME} (renamed)`;
  await page.getByLabel('Organisation name').fill(nextName);
  await page.getByRole('button', { name: 'Save changes' }).click();
  // `exact` matters: the card's inline "Saved" is a substring of the
  // "Organization settings saved" toast, so a loose match resolves to both and
  // trips Playwright's strict mode.
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();

  await reloadFromServer(page);
  await expect(page.getByLabel('Organisation name')).toHaveValue(nextName, { timeout: 20_000 });
  await expect(page.locator('[data-sidebar=header]').getByText(nextName)).toBeVisible();

  await api.dispose();
});

test('General refuses an empty name before asking the server', async ({ page }) => {
  const { user, api } = await provisionedUser('settingsempty');
  await signInAs(page, user);
  await openSettings(page);

  await expect(page.getByLabel('Organisation name')).toHaveValue(ORGANIZATION_NAME, {
    timeout: 20_000,
  });
  await page.getByLabel('Organisation name').fill('');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByText('This field is required')).toBeVisible();

  await api.dispose();
});

test('Security shows this device among the account’s sessions', async ({ page }) => {
  const { user, api } = await provisionedUser('settingssec');
  await signInAs(page, user);
  await openSettings(page);
  await openSection(page, 'Security');

  await expect(page.getByRole('heading', { name: 'Active sessions', level: 3 })).toBeVisible();
  await expect(page.getByText('This device')).toBeVisible();

  await api.dispose();
});

test('API mints a key, shows the secret once, and revokes it', async ({ page }) => {
  const { user, api } = await provisionedUser('settingsapi');
  await signInAs(page, user);
  await openSettings(page);
  await openSection(page, 'API & webhooks');

  await expect(page.getByRole('heading', { name: 'API keys', level: 3 })).toBeVisible();

  // Unique per run: a revoked key stays on the list, so a fixed name would
  // match every key an earlier run left behind.
  const keyName = `e2e key ${Date.now()}`;
  const rows = page.locator('[data-slot="section-row"]');

  await page.getByRole('button', { name: 'Create key' }).click();
  await page.getByLabel('Key name').fill(keyName);
  // The picker grants a level per resource group, so a key is scoped by
  // choosing one — each group is a ToggleGroup of buttons (No access / Read /
  // Edit), so grant the first resource Read by clicking its button.
  await page.getByRole('dialog').getByRole('button', { name: 'Read', exact: true }).first().click();
  await page.getByRole('button', { name: 'Create key', exact: true }).last().click();

  // The secret exists exactly once, in the reply to the call that minted it.
  await expect(page.getByRole('heading', { name: 'Copy your new key' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).last().click();
  await expect(page.getByText(keyName)).toBeVisible();

  // Reload rather than trust the list the mutation just patched.
  await reloadFromServer(page);
  await expect(page.getByText(keyName)).toBeVisible({ timeout: 20_000 });

  const keyRow = rows.filter({ hasText: keyName });
  await keyRow.getByRole('button', { name: 'Revoke' }).click();
  await expect(keyRow.getByText('Revoked')).toBeVisible();

  await api.dispose();
});
