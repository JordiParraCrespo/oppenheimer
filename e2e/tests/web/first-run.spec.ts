import { expect, test } from '@playwright/test';
import { newUser } from '../../support/auth';
import { findOrganizationsForUser, findUserByEmail, query } from '../../support/db';
import { registerThroughUi } from '../../support/web';

/**
 * The walk a new account actually takes: register → name the workspace →
 * Connect GitHub → Add host → Ready → the console.
 *
 * Every step here talks to the API. That is the point: the screens were
 * scaffolds that looked right and wrote nothing, and the repositories under
 * them were written against a design note rather than the built endpoints —
 * `HostsRepository` read `state` for a field the API sends as `online`, and
 * `SessionsRepository` mapped a paginated envelope as if it were an array.
 * Neither was caught, because nothing called them. A green unit suite over the
 * wrong wire is the failure this spec exists to prevent.
 *
 * GitHub and the host step are skipped: both are optional by design, and
 * neither can be driven here — one installs an App on a real GitHub account,
 * the other needs a runner release to fetch. What is asserted is that skipping
 * them is possible and that Ready says so rather than inventing a summary.
 */
test('a new account walks the first-run flow into the console', async ({ page }) => {
  const user = newUser('firstrunwalk');

  await registerThroughUi(page, user);
  await expect(page).toHaveURL(/\/onboarding\/workspace/, { timeout: 30_000 });

  // The step opens on the workspace sign-up provisioned, not an empty form.
  const account = await findUserByEmail(user.email);
  const before = await findOrganizationsForUser(account?.id ?? '');
  expect(before).toHaveLength(1);

  // Naming it: the address follows the name, and the availability check is the
  // API's — `POST /organizations/check-slug`, not a timer.
  const name = `Walk ${Date.now().toString(36)}`;
  await page.getByLabel(/workspace name/i).fill(name);
  await expect(page.getByText(/is available/i)).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page).toHaveURL(/\/onboarding\/github/, { timeout: 30_000 });

  // Renamed, not duplicated. The account still owns exactly one workspace, and
  // its address is no longer the provisional one sign-up minted.
  const after = await query<{ id: string; name: string; slug: string }>(
    `SELECT o."id", o."name", o."slug" FROM "organization" o
       JOIN "member" m ON m."organizationId" = o."id"
      WHERE m."userId" = $1`,
    [account?.id ?? ''],
  );
  expect(after).toHaveLength(1);
  expect(after[0]?.name).toBe(name);
  expect(after[0]?.slug).not.toMatch(/-[0-9a-f]{8}$/);

  // Both remaining steps are skippable, which is what keeps the flow finishable
  // on a deployment with no GitHub App and no runner release configured.
  await page.getByRole('link', { name: /skip for now/i }).click();
  await expect(page).toHaveURL(/\/onboarding\/host/, { timeout: 30_000 });

  await page.getByRole('link', { name: /skip for now/i }).click();
  await expect(page).toHaveURL(/\/onboarding\/ready/, { timeout: 30_000 });

  // Ready summarises what the steps produced and says plainly what they did
  // not, rather than printing a zero or naming an unrelated row.
  await expect(page.getByText(after[0]?.slug ?? '')).toBeVisible();
  await expect(page.getByText(/not connected/i)).toBeVisible();
  await expect(page.getByText(/no host yet/i)).toBeVisible();

  await page.getByRole('link', { name: /go to the console/i }).click();
  await expect(page).toHaveURL(/\/sessions/, { timeout: 30_000 });
});

/**
 * The gate: a workspace that has been named is finished with this step.
 * Without it, every visit to the flow re-opens the slug form over an address
 * `check-slug` now counts as taken — its own.
 */
test('a named workspace is not sent back through the slug form', async ({ page }) => {
  const user = newUser('firstrunagain');

  await registerThroughUi(page, user);
  await expect(page).toHaveURL(/\/onboarding\/workspace/, { timeout: 30_000 });

  await page.getByLabel(/workspace name/i).fill(`Once ${Date.now().toString(36)}`);
  await expect(page.getByText(/is available/i)).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page).toHaveURL(/\/onboarding\/github/, { timeout: 30_000 });

  await page.goto('/onboarding/workspace');
  await expect(page).toHaveURL(/\/sessions/, { timeout: 30_000 });
});
