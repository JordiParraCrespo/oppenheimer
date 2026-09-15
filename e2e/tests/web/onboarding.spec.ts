import { expect, test } from '@playwright/test';
import { newUser } from '../../support/auth';
import { findOrganizationsForUser, findUserByEmail } from '../../support/db';
import { registerThroughUi } from '../../support/web';

/**
 * The first run of an account that registers without an invitation.
 *
 * Registering creates an account, not a tenancy. The product shell reads
 * organization-scoped data on every screen, so the app used to send a brand-new
 * account to a dashboard that could only answer "You do not have permission to
 * do that". It has to offer the thing that fixes it instead: a workspace of
 * their own, or the invitation someone already sent them.
 */
test('a newcomer creates a workspace from onboarding and lands on the dashboard', async ({
  page,
}) => {
  const user = newUser('firstrun');

  await registerThroughUi(page, user);
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 30_000 });

  // Not a refusal: the screen says what to do next, and no page-level alert.
  await expect(page.getByRole('heading', { name: /create your workspace/i })).toBeVisible();
  await expect(page.locator('[data-slot="alert"]')).toHaveCount(0);

  await page.getByLabel('Workspace name').fill('Nora & Co');
  await page.getByRole('button', { name: 'Create workspace' }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

  // The workspace is real, owned by the account that made it, and the shell
  // names it.
  const account = await findUserByEmail(user.email);
  expect(account).toBeTruthy();
  const memberships = await findOrganizationsForUser(account?.id ?? '');
  expect(memberships).toEqual([expect.objectContaining({ role: 'owner', orgName: 'Nora & Co' })]);
  await expect(page.getByText('Nora & Co').first()).toBeVisible();

  // And it sticks: the dashboard is theirs now, not onboarding.
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
});

test('onboarding refuses an empty workspace name before asking the server', async ({ page }) => {
  const user = newUser('firstrunempty');

  await registerThroughUi(page, user);
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 30_000 });

  let apiCalled = false;
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/organizations') && request.method() === 'POST') {
      apiCalled = true;
    }
  });
  await page.getByRole('button', { name: 'Create workspace' }).click();

  await expect(page.getByText('This field is required')).toBeVisible();
  expect(apiCalled).toBe(false);
});

test('onboarding is not a trap: the newcomer can sign out', async ({ page }) => {
  const user = newUser('firstrunout');

  await registerThroughUi(page, user);
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 30_000 });

  await page.getByRole('button', { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
});
