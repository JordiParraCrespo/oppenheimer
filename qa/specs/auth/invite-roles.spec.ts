import { expect } from '@playwright/test';
import { FIXTURE_ACCOUNTS } from '../../fixtures/index.js';
import { applicationRolesOf, findUser, membershipsOf, withDb } from '../../src/db.js';
import { API_URL, scenario, signIn, signInThroughApi } from '../../src/harness.js';
import { mailCount, waitForMailLink } from '../../src/mail-sink.js';
import { TRANSIENT } from './accounts.js';

const INVITEES = [
  { role: 'admin' as const, account: TRANSIENT.inviteeAdmin },
  { role: 'member' as const, account: TRANSIENT.inviteeMember },
];

scenario('AUTH-03', async ({ page, qa, fixture }) => {
  const organizationId = fixture?.organizationId;
  expect(organizationId, 'the baseline fixture must have a workspace').toBeTruthy();

  const owner = FIXTURE_ACCOUNTS.baseline;
  const signedIn = await signInThroughApi(page, owner.email, owner.password);
  qa.check('the workspace owner signs in', signedIn);

  const links = new Map<string, string>();
  for (const { role, account } of INVITEES) {
    const seen = mailCount('INVITATION', account.email);
    const response = await page.request.post(
      `${API_URL}/api/v1/organizations/${organizationId}/invitations`,
      { data: { email: account.email, role } },
    );
    qa.check(
      `the owner can invite ${account.email} as ${role}`,
      response.ok(),
      `HTTP ${response.status()} ${response.ok() ? '' : await response.text()}`,
    );
    if (!response.ok()) continue;
    links.set(account.email, await waitForMailLink('INVITATION', account.email, { after: seen }));
  }
  qa.check(
    'both invitations reached the mail sink',
    links.size === INVITEES.length,
    `${links.size} link(s)`,
  );

  for (const { role, account } of INVITEES) {
    const link = links.get(account.email);
    if (!link) continue;
    await page.context().clearCookies();
    await page.goto(link);
    await page.waitForLoadState('networkidle').catch(() => {});

    // Accepting is a registration for a newcomer: the link carries the address,
    // so only a password is asked for.
    const passwordField = page.locator('#password').first();
    if (await passwordField.isVisible().catch(() => false)) {
      // The form asks for a full name as well as a password: the link carries
      // the address and the role, but not who the person is.
      const nameField = page.locator('#name, #fullName').first();
      if (await nameField.isVisible().catch(() => false)) {
        await nameField.fill(`${account.firstName} ${account.lastName}`);
      }
      await passwordField.fill(account.password);
      const confirmField = page.locator('#confirmPassword');
      if (await confirmField.isVisible().catch(() => false))
        await confirmField.fill(account.password);
      await page
        .getByRole('button', { name: /accept|join|create/i })
        .first()
        .click();
    }
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle').catch(() => {});

    qa.check(
      `the ${role} invitee lands signed in on the dashboard rather than on onboarding`,
      page.url().includes('/dashboard'),
      page.url(),
    );
    await qa.shot(
      page,
      `auth-03-invitation-accepted-${role}`,
      `The first screen the invited ${role} reaches`,
    );

    const user = await withDb((pool) => findUser(pool, account.email));
    qa.check(`the ${role} invitee has an account`, Boolean(user), account.email);
    if (!user) continue;

    const memberships = await withDb((pool) => membershipsOf(pool, user.id));
    const membership = memberships.find((entry) => entry.organizationId === organizationId);
    qa.check(`the ${role} invitee joined the inviting workspace`, Boolean(membership));
    qa.checkEqual(
      `the ${role} invitee's membership role is the one invited`,
      membership?.role,
      role,
    );

    // The third reading. The membership role is Better Auth's; the application
    // role is what the product maps it to, and the pack this was ported from
    // found those two disagreeing after an invitation. Recorded either way, so
    // a later divergence is visible in the report rather than inferred.
    const applicationRoles = await withDb((pool) => applicationRolesOf(pool, user.id));
    qa.note(
      `the ${role} invitee holds membership role ${JSON.stringify(membership?.role)} and ` +
        `application role(s) ${applicationRoles.join(', ') || '(none)'}`,
    );
    qa.check(
      `the ${role} invitee holds an application role at all`,
      applicationRoles.length > 0,
      'an invitee with no application role can sign in and read nothing',
    );

    await page.context().clearCookies();
    const returned = await signIn(page, account.email, account.password);
    qa.check(`the ${role} invitee can sign in again later`, returned);
    const laterMemberships = await withDb((pool) => membershipsOf(pool, user.id));
    qa.checkEqual(
      `the ${role} invitee still holds the same role on a later sign-in`,
      laterMemberships.find((entry) => entry.organizationId === organizationId)?.role,
      role,
    );
  }
});
