import { randomInt } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { newUser } from '../../support/auth';
import { findOrganizationsForUser, findUserByEmail, query } from '../../support/db';
import { claimInstallation } from '../../support/github-stub';
import { GITHUB_STUB_URL, STUB_INSTALL_URL } from '../../support/sessions';
import {
  claimWorkspaceThroughUi,
  provisionedUser,
  registerThroughUi,
  signInAs,
} from '../../support/web';

/**
 * The walk a new account actually takes: register → name the workspace →
 * Connect GitHub → Add host → Ready → the console.
 *
 * Every step talks to the API, because a green unit suite over the wrong wire
 * is the failure this guards: `HostsRepository` once read `state` for a field
 * the API sends as `online`, and nothing called it.
 *
 * The walk skips GitHub and the host step (Connect GitHub has its own test
 * below; the host step needs a runner release), so what is asserted is that
 * skipping them works and Ready says so rather than inventing a summary.
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
  // The address moves before the step draws: wait for the host step itself, or
  // the next click lands on the GitHub step's own Skip link still on screen.
  await expect(page.getByRole('heading', { name: /add your first host/i })).toBeVisible();

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
 * A deployment with no runner release configured reports `hosts: false`, and
 * the host step reads that before it mints: it explains, and Skip is the way on.
 *
 * The capability is answered here rather than read off the stack, so the spec
 * holds whichever way the deployment under test is configured; what it proves
 * is that the console takes the server's word and asks for no token.
 */
test('the host step explains, and mints nothing, on a deployment that cannot pair', async ({
  page,
}) => {
  await page.route('**/api/v1/health/capabilities', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), hosts: false } });
  });
  const mints: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/v1/hosts/pairing')) {
      mints.push(request.url());
    }
  });

  const user = newUser('firstrunnohosts');
  await registerThroughUi(page, user);
  await claimWorkspaceThroughUi(page, 'NoHosts');

  await page.getByRole('link', { name: /skip for now/i }).click();
  await expect(page).toHaveURL(/\/onboarding\/host/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: /add your first host/i })).toBeVisible();

  await expect(page.getByText(/can't pair machines yet/i)).toBeVisible();
  await expect(page.getByText(/waiting for the host/i)).toHaveCount(0);
  await expect(page.getByRole('link', { name: /continue/i })).toHaveCount(0);
  expect(mints, 'no pairing token is asked for').toEqual([]);

  // Skip is the way on, and Ready says there is no host rather than an error.
  await page.getByRole('link', { name: /skip for now/i }).click();
  await expect(page).toHaveURL(/\/onboarding\/ready/, { timeout: 30_000 });
  await expect(page.getByText(/no host yet/i)).toBeVisible();
  expect(mints).toEqual([]);
});

/**
 * The gate: a workspace that has been named is finished with this step.
 * Without it, every visit to the flow re-opens the slug form over an address
 * `check-slug` now counts as taken — its own.
 *
 * Ready is shut with it: step 3's Back links to this step, so a mid-walk
 * reader reaches the console through that redirect, and shown-once must hold
 * for them too, not only for readers who left by the button.
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
 * A finished account could press Back into Ready and be congratulated again.
 * Being finished cannot be the test, since every legitimate arrival at Ready is
 * finished too (the address is claimed by step 2); having walked there is.
 */
test('a finished account cannot walk back into the flow', async ({ page }) => {
  const user = newUser('firstrunover');

  await registerThroughUi(page, user);
  await claimWorkspaceThroughUi(page, 'Over');

  // Mid-walk the landing is reachable, claimed address and all.
  await page.getByRole('link', { name: /skip for now/i }).click();
  await expect(page).toHaveURL(/\/onboarding\/host/, { timeout: 30_000 });
  // Wait for the host step to draw, as in the walk above.
  await expect(page.getByRole('heading', { name: /add your first host/i })).toBeVisible();
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

  // Step 4 goes with it: the console pairs a machine in Add host now, so
  // nothing links here and the step is first-run's alone.
  await page.goto('/onboarding/host');
  await expect(page).toHaveURL(/\/sessions/, { timeout: 30_000 });

  // Connect GitHub is the one step that stays open, because every App install
  // returns to it, including one a finished account starts from New session's
  // repository chip (`new-session.spec.ts`).
  await page.goto('/onboarding/github');
  await expect(page).toHaveURL(/\/onboarding\/github/, { timeout: 30_000 });
});

/**
 * A GitHub callback this console did not start is never posted (why:
 * `tests/api/github-install-state.spec.ts`). Without a state minted here, the
 * step says so and posts nothing.
 */
test('a GitHub callback without a state is refused on screen, not posted', async ({ page }) => {
  const owner = await provisionedUser('ghunstarted');
  await signInAs(page, owner.user);

  const posts: string[] = [];
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/v1/installations'
    ) {
      posts.push(request.url());
    }
  });

  await page.goto(
    '/onboarding/github?installation_id=4242&code=stub-oauth-code&setup_action=install',
  );
  await expect(page.getByText(/this github link was not started here/i)).toBeVisible();
  // The legacy walk marker carries no nonce either, so it keeps the walk and
  // still posts nothing.
  await page.goto('/onboarding/github?installation_id=4242&code=stub-oauth-code&state=first-run');
  await expect(page.getByText(/this github link was not started here/i)).toBeVisible();
  expect(posts).toEqual([]);

  await owner.api.dispose();
});

/**
 * The round trip Connect GitHub makes: mint a state on click, leave for the
 * App's install page with it, come back with GitHub's `installation_id`,
 * `code` and that same `state`, and land connected. GitHub is answered here;
 * the stub lists the installation for the code, as GitHub would.
 */
test('Connect GitHub carries a minted state through the install round trip', async ({ page }) => {
  const owner = await provisionedUser('ghroundtrip');
  await signInAs(page, owner.user);
  const githubInstallationId = await claimInstallation(
    GITHUB_STUB_URL,
    randomInt(1_000_000, 2 ** 40),
  );

  await page.route('https://github.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<p>GitHub</p>' }),
  );
  await page.goto('/onboarding/github');
  await page.getByRole('button', { name: /connect github/i }).click();
  await page.waitForURL((url) => url.href.startsWith(`${STUB_INSTALL_URL}?state=`));
  const state = new URL(page.url()).searchParams.get('state') ?? '';
  expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);

  await page.goto(
    `/onboarding/github?installation_id=${githubInstallationId}&code=stub-oauth-code&setup_action=install&state=${state}`,
  );
  // Connected: the spent parameters are dropped from the address on success.
  await expect(page).toHaveURL(/\/onboarding\/github$/, { timeout: 30_000 });
  await expect(page.getByText(/this github link was not started here/i)).toHaveCount(0);
  await expect(page.getByRole('link', { name: /continue/i })).toBeVisible();

  await owner.api.dispose();
});
