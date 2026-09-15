import { applicationRolesOf, findUser, membershipsOf, withDb } from '../../src/db.js';
import { scenario, signIn } from '../../src/harness.js';
import { registerThroughUi, TRANSIENT, visibleMessage } from './accounts.js';

const WORKSPACE_NAME = 'QA Newcomer Workspace';

scenario('AUTH-05', async ({ page, qa }) => {
  const account = TRANSIENT.newcomer;
  await registerThroughUi(page, account);
  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle').catch(() => {});
  await qa.shot(page, 'auth-05-registered', 'Where registering leaves a brand-new account');

  const landing = new URL(page.url()).pathname;
  qa.note(`registering landed on ${landing}`);
  qa.check(
    'registering signs the account in rather than returning it to the login screen',
    !landing.includes('/login'),
    landing,
  );

  const user = await withDb((pool) => findUser(pool, account.email));
  qa.check('the account exists in the database', Boolean(user), account.email);
  const memberships = user ? await withDb((pool) => membershipsOf(pool, user.id)) : [];
  const roles = user ? await withDb((pool) => applicationRolesOf(pool, user.id)) : [];
  qa.note(
    `the new account holds ${memberships.length} membership(s) and the application role(s) ` +
      `${roles.join(', ') || '(none)'}`,
  );

  // The repo states this plainly: sign-up creates an account, not a workspace,
  // and an org-less account goes to onboarding. The two claims have to agree
  // with each other *and* with the database — a screen that says "no workspace
  // yet" over a row that says otherwise is a finding either way round, so the
  // scenario reports the pair rather than assuming which is true.
  const screenSaysNoWorkspace = landing.includes('/onboarding');
  qa.check(
    'the screen and the database agree about whether a workspace exists',
    screenSaysNoWorkspace === (memberships.length === 0),
    `landed on ${landing} with ${memberships.length} membership(s) — CLAUDE.md says sign-up ` +
      'creates an account, not a workspace, and an org-less account is sent to /onboarding',
  );
  qa.check(
    'a self-service registration is sent to onboarding, not to a refusal',
    screenSaysNoWorkspace || memberships.length > 0,
    landing,
  );

  const firstScreen = await visibleMessage(page);
  qa.check(
    'the first screen says where the reader stands rather than refusing them',
    !/permission|not allowed|forbidden|denied/i.test(firstScreen),
    firstScreen.slice(0, 200),
  );

  if (screenSaysNoWorkspace) {
    await qa.shot(page, 'auth-05-onboarding', 'Onboarding, the first screen a newcomer reaches');

    // An empty name is the browser's to refuse.
    let requested = false;
    await page.route('**/api/v1/organizations', (route) => {
      requested = true;
      return route.continue();
    });
    await page
      .getByRole('button', { name: /create|continue/i })
      .first()
      .click();
    await page.waitForTimeout(1000);
    qa.check('onboarding refuses an empty workspace name before asking the server', !requested);
    await page.unroute('**/api/v1/organizations');

    await page.locator('#organization-name').fill(WORKSPACE_NAME);
    await page
      .getByRole('button', { name: /create|continue/i })
      .first()
      .click();
    await page.waitForTimeout(3000);
  } else {
    qa.note('sign-up already provisioned a workspace, so onboarding was never reached');
    await qa.shot(page, 'auth-05-onboarding', 'The screen that stood in for onboarding');
  }

  await page.waitForLoadState('networkidle').catch(() => {});
  qa.check(
    'the first workspace lands the newcomer on the dashboard',
    page.url().includes('/dashboard'),
    page.url(),
  );
  await qa.shot(
    page,
    'auth-05-first-dashboard',
    'The first dashboard a self-service account reaches',
  );

  await page.context().clearCookies();
  qa.check('the newcomer can sign in again', await signIn(page, account.email, account.password));
  await page.waitForLoadState('networkidle').catch(() => {});
  qa.check(
    'the second sign-in skips onboarding, because the workspace already exists',
    page.url().includes('/dashboard'),
    page.url(),
  );
});
