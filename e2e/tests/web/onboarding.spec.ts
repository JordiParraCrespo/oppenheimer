import { expect, test } from '@playwright/test';
import { newUser } from '../../support/auth';
import {
  findOrganizationsForUser,
  findTeamsForUser,
  findUserByEmail,
  query,
} from '../../support/db';
import { registerThroughUi } from '../../support/web';

/**
 * The first run of an account that registers without an invitation.
 *
 * Registering creates the personal workspace: one organization owned by the
 * account, no team, no roster (`product/versions/mvp/00-scope.md`). So a
 * newcomer lands on the sessions list, not on a screen asking them to make a
 * workspace first.
 */
test('a newcomer lands in their personal workspace', async ({ page }) => {
  const user = newUser('firstrun');

  await registerThroughUi(page, user);
  await expect(page).toHaveURL(/\/sessions/, { timeout: 30_000 });
  await expect(page.locator('[data-slot="alert"]')).toHaveCount(0);

  // One workspace, owned by the account, named after it, with no team.
  const account = await findUserByEmail(user.email);
  expect(account).toBeTruthy();
  const memberships = await findOrganizationsForUser(account?.id ?? '');
  expect(memberships).toEqual([expect.objectContaining({ role: 'owner' })]);
  expect(await findTeamsForUser(account?.id ?? '')).toEqual([]);

  // And it sticks: onboarding has nothing to offer an account with a workspace.
  await page.goto('/onboarding');
  await expect(page).toHaveURL(/\/sessions/, { timeout: 30_000 });
});

/**
 * Onboarding stays as the recovery path for an account that has no workspace
 * (the sign-up hook is best-effort). The tests below put an account in that
 * state the only way it can happen: by removing its membership.
 */
async function registerWithoutWorkspace(
  page: Parameters<typeof registerThroughUi>[0],
  user: ReturnType<typeof newUser>,
) {
  await registerThroughUi(page, user);
  await expect(page).toHaveURL(/\/sessions/, { timeout: 30_000 });
  const account = await findUserByEmail(user.email);
  await query(
    `DELETE FROM "organization" WHERE "id" IN (SELECT "organizationId" FROM "member" WHERE "userId" = $1)`,
    [account?.id ?? ''],
  );
  await page.goto('/sessions');
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 30_000 });
}

test('an account without a workspace creates one from onboarding', async ({ page }) => {
  const user = newUser('firstrunrepair');
  await registerWithoutWorkspace(page, user);

  // Not a refusal: the screen says what to do next, and no page-level alert.
  await expect(page.getByRole('heading', { name: /create your workspace/i })).toBeVisible();
  await expect(page.locator('[data-slot="alert"]')).toHaveCount(0);

  await page.getByLabel('Workspace name').fill('Nora & Co');
  await page.getByRole('button', { name: 'Create workspace' }).click();

  await expect(page).toHaveURL(/\/sessions/, { timeout: 30_000 });

  const account = await findUserByEmail(user.email);
  const memberships = await findOrganizationsForUser(account?.id ?? '');
  expect(memberships).toEqual([expect.objectContaining({ role: 'owner', orgName: 'Nora & Co' })]);
  await expect(page.getByText('Nora & Co').first()).toBeVisible();
});

test('onboarding refuses an empty workspace name before asking the server', async ({ page }) => {
  const user = newUser('firstrunempty');
  await registerWithoutWorkspace(page, user);

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
  await registerWithoutWorkspace(page, user);

  await page.getByRole('button', { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
});
