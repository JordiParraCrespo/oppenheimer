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
 * How an account arrives in first-run, and what `/onboarding` means.
 *
 * The walk itself is `first-run.spec.ts`. This file covers the two ways in —
 * a fresh sign-up, and the account whose sign-up hook left it with no
 * workspace — and the fact that both land on the same step. `/onboarding` is
 * the door to the walk, not a screen: it used to hold a second
 * create-workspace form beside the one at `/onboarding/workspace`, and the
 * step subsumed it once `claimPersonalWorkspace` learned to create when there
 * is no row to name.
 */
test('a newcomer is sent to name the workspace sign-up made', async ({ page }) => {
  const user = newUser('firstrun');

  await registerThroughUi(page, user);
  await expect(page).toHaveURL(/\/onboarding\/workspace/, { timeout: 30_000 });
  await expect(page.locator('[data-slot="alert"]')).toHaveCount(0);

  // One workspace already, owned by the account, with no team.
  const account = await findUserByEmail(user.email);
  expect(account).toBeTruthy();
  const memberships = await findOrganizationsForUser(account?.id ?? '');
  expect(memberships).toEqual([expect.objectContaining({ role: 'owner' })]);
  expect(await findTeamsForUser(account?.id ?? '')).toEqual([]);

  // And the index is a door: it opens the step rather than a screen of its own.
  await page.goto('/onboarding');
  await expect(page).toHaveURL(/\/onboarding\/workspace/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: /name your workspace/i })).toBeVisible();
});

/**
 * The recovery path. Sign-up provisions the workspace, but the hook is
 * best-effort, so an account can hold none — which every product screen reads
 * as a refusal. `_authenticated` sends it to `/onboarding`, and from there it
 * is the ordinary step that serves it.
 *
 * The only way to reach that state is to remove the membership.
 */
async function registerWithoutWorkspace(
  page: Parameters<typeof registerThroughUi>[0],
  user: ReturnType<typeof newUser>,
) {
  await registerThroughUi(page, user);
  await expect(page).toHaveURL(/\/onboarding\/workspace/, { timeout: 30_000 });
  const account = await findUserByEmail(user.email);
  await query(
    `DELETE FROM "organization" WHERE "id" IN (SELECT "organizationId" FROM "member" WHERE "userId" = $1)`,
    [account?.id ?? ''],
  );
  await page.goto('/sessions');
  await expect(page).toHaveURL(/\/onboarding\/workspace/, { timeout: 30_000 });
}

test('an account with no workspace is served by the workspace step', async ({ page }) => {
  const user = newUser('firstrunrepair');
  await registerWithoutWorkspace(page, user);

  // Not a refusal: the step it lands on is the one that names a workspace, and
  // there is no page-level alert about the one it does not have.
  await expect(page.getByRole('heading', { name: /name your workspace/i })).toBeVisible();
  await expect(page.locator('[data-slot="alert"]')).toHaveCount(0);

  await page.getByLabel('Workspace name').fill('Nora & Co');
  await expect(page.getByText(/is available/i)).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Continue' }).click();

  // On into the walk, and the claim created rather than renamed: one workspace,
  // owned by the account, carrying the name it was just given.
  await expect(page).toHaveURL(/\/onboarding\/github/, { timeout: 30_000 });

  const account = await findUserByEmail(user.email);
  const memberships = await findOrganizationsForUser(account?.id ?? '');
  expect(memberships).toEqual([expect.objectContaining({ role: 'owner', orgName: 'Nora & Co' })]);
});

test('the workspace step does not ask the server for an empty name', async ({ page }) => {
  const user = newUser('firstrunempty');
  await registerWithoutWorkspace(page, user);

  let apiCalled = false;
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/organizations') && request.method() === 'POST') {
      apiCalled = true;
    }
  });

  // Continue is held until there is a name and a free address, so an empty
  // form cannot reach the API at all.
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  expect(apiCalled).toBe(false);
});

test('first-run is not a trap: the newcomer can sign out', async ({ page }) => {
  const user = newUser('firstrunout');
  await registerWithoutWorkspace(page, user);

  // Leaving has to end the session, or `/login` bounces straight back in.
  await page.getByRole('button', { name: 'Use a different account' }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
});
