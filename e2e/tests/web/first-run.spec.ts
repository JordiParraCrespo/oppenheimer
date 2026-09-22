import { expect, test } from '@playwright/test';
import { newUser } from '../../support/auth';
import { findOrganizationsForUser, findUserByEmail, query } from '../../support/db';
import { claimWorkspaceThroughUi, registerThroughUi } from '../../support/web';

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

  const name = await claimWorkspaceThroughUi(page, 'Walk');

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
 *
 * And that redirect is the path that used to leave the flow half-open. Step
 * 3's Back is a link to this step, so a mid-walk reader lands in the console
 * through it on the happy path — after which Ready must be shut too, or
 * shown-once holds only for readers who left by the button.
 */
test('a named workspace is not sent back through the slug form', async ({ page }) => {
  const user = newUser('firstrunagain');

  await registerThroughUi(page, user);
  await claimWorkspaceThroughUi(page, 'Once');

  await page.goto('/onboarding/workspace');
  await expect(page).toHaveURL(/\/sessions/, { timeout: 30_000 });

  await page.goto('/onboarding/ready');
  await expect(page).toHaveURL(/\/sessions/, { timeout: 30_000 });
});

/**
 * Shown once, and the whole flow — not just the step that names the workspace.
 *
 * Ready is where it showed: an account that had finished days ago could press
 * Back out of the console, or type the URL, and be congratulated all over
 * again on a walk it had no way to re-take. Being finished cannot be the test,
 * because every legitimate arrival at Ready is finished too — the address is
 * claimed by the end of step 2. Having walked there is.
 *
 * Connect GitHub and Add host stay open on purpose: they are also New
 * session's install-the-App and pair-a-machine screens, and `new-session.spec.ts`
 * walks the console into both.
 */
test('a finished account cannot walk back into the flow', async ({ page }) => {
  const user = newUser('firstrunover');

  await registerThroughUi(page, user);
  await claimWorkspaceThroughUi(page, 'Over');

  // Mid-walk the landing is reachable, claimed address and all.
  await page.getByRole('link', { name: /skip for now/i }).click();
  await expect(page).toHaveURL(/\/onboarding\/host/, { timeout: 30_000 });
  await page.getByRole('link', { name: /skip for now/i }).click();
  await expect(page).toHaveURL(/\/onboarding\/ready/, { timeout: 30_000 });

  // Going to the console ends the walk, and replaces the landing in history so
  // Back cannot return to it.
  await page.getByRole('link', { name: /go to the console/i }).click();
  await expect(page).toHaveURL(/\/sessions/, { timeout: 30_000 });
  await page.goBack();
  await expect(page).not.toHaveURL(/\/onboarding\/ready/, { timeout: 30_000 });

  // And the address itself is refused, with or without what the walk carried.
  await page.goto('/onboarding/ready');
  await expect(page).toHaveURL(/\/sessions/, { timeout: 30_000 });

  await page.goto('/onboarding');
  await expect(page).toHaveURL(/\/sessions/, { timeout: 30_000 });

  // The two steps the console shares stay reachable once the walk is over —
  // New session's empty states link straight at them, and version 1 draws no
  // other screen that pairs a machine or installs the App.
  await page.goto('/onboarding/github');
  await expect(page).toHaveURL(/\/onboarding\/github/, { timeout: 30_000 });

  await page.goto('/onboarding/host');
  await expect(page).toHaveURL(/\/onboarding\/host/, { timeout: 30_000 });
});
