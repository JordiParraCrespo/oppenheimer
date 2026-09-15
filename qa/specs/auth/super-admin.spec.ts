import { expect } from '@playwright/test';
import { findUser, withDb } from '../../src/db.js';
import { API_URL, scenario, signIn } from '../../src/harness.js';
import { SEEDED } from './accounts.js';

/** A rule set that can do anything, however it is spelled. */
function isUnrestricted(rules: Array<{ action: string; subject: string }>): boolean {
  return rules.some((rule) => rule.action === 'manage' && rule.subject === 'all');
}

scenario('AUTH-01', async ({ page, qa, openAdmin }) => {
  const signedIn = await signIn(page, SEEDED.superAdmin.email, SEEDED.superAdmin.password);
  if (!qa.check('the seeded super admin can sign in', signedIn)) {
    // Nothing below this can be measured without a session, and the seed not
    // having run is a setup problem rather than a product finding.
    expect(
      signedIn,
      'the platform seed must have run — `pnpm --filter @oppenheimer/api seed`',
    ).toBe(true);
  }
  await page.waitForLoadState('networkidle').catch(() => {});
  await qa.shot(
    page,
    'auth-01-superadmin-dashboard',
    'The super admin, signed in to the consumer app',
  );

  const seeded = await withDb((pool) => findUser(pool, SEEDED.superAdmin.email));
  qa.checkEqual('the account carries the superadmin platform role', seeded?.role, 'superadmin');

  // The point of the scenario. A role *name* is free; what matters is the rule
  // set behind it, and the two come apart without anything on screen changing.
  const permissions = await page.request.get(`${API_URL}/api/v1/users/me/permissions`);
  qa.check('the permission set can be read', permissions.ok(), `HTTP ${permissions.status()}`);
  const body = permissions.ok()
    ? ((await permissions.json()) as { permissions: Array<{ action: string; subject: string }> })
    : { permissions: [] };
  qa.note(`the API reports ${body.permissions.length} rule(s) for the super admin`);
  qa.check(
    'the super admin holds unrestricted access, not merely a suggestive role name',
    isUnrestricted(body.permissions),
    `rules: ${body.permissions.map((rule) => `${rule.action}:${rule.subject}`).join(', ')}`,
  );

  const admin = await openAdmin();
  const admittedToControlPlane = await signIn(
    admin,
    SEEDED.superAdmin.email,
    SEEDED.superAdmin.password,
  );
  qa.check('the control plane admits the super admin', admittedToControlPlane);
  if (admittedToControlPlane) {
    await admin.goto('/users');
    await admin.waitForLoadState('networkidle').catch(() => {});
    const users = await admin.request.get(`${API_URL}/api/v1/users`);
    qa.check('the users endpoint answers the super admin', users.ok(), `HTTP ${users.status()}`);
  }
  await qa.shot(
    admin,
    'admin-auth-01-superadmin-users',
    'The control plane, opened by the super admin',
  );
});
