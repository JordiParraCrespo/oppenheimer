import { expect } from '@playwright/test';
import { applyFixture, FIXTURE_ACCOUNTS } from '../../fixtures/index.js';
import { findUser, organizationCounts, withDb } from '../../src/db.js';
import { API_URL, scenario, signIn } from '../../src/harness.js';

scenario('AUTH-06', async ({ page, qa, fixture }) => {
  const organizationId = fixture?.organizationId;
  expect(organizationId, 'the empty fixture must have a workspace').toBeTruthy();

  // The other tenant. Applied here rather than declared as this scenario's
  // fixture because a scenario gets one state applied and this one needs two:
  // the reader's, and the workspace whose data must stay invisible.
  const other = await applyFixture('volume');
  expect(other, 'the volume fixture must have a workspace').toBeTruthy();

  const reader = FIXTURE_ACCOUNTS.empty;
  const readerRow = await withDb((pool) => findUser(pool, reader.email));

  // Asserted before anything is measured. A `user.role` of admin or superadmin
  // drops the organization predicate everywhere, so a reader holding one would
  // legitimately see the other tenant and the scenario would be measuring the
  // bypass rather than the product.
  qa.checkEqual(
    'the reader is a tenant owner and not a platform administrator',
    readerRow?.role,
    'user',
  );

  const mine = await withDb((pool) => organizationCounts(pool, organizationId as string));
  const theirs = await withDb((pool) => organizationCounts(pool, other?.organizationId as string));
  qa.note(
    `the reader's workspace holds ${mine.members} members and ${mine.teams} teams; ` +
      `the other holds ${theirs.members} members and ${theirs.teams} teams`,
  );
  qa.check(
    'the two tenants are different enough that a leak would be unmistakable',
    theirs.members > mine.members * 10,
    `${mine.members} vs ${theirs.members}`,
  );

  qa.check('the reader signs in', await signIn(page, reader.email, reader.password));
  await page.waitForLoadState('networkidle').catch(() => {});
  await qa.shot(
    page,
    'auth-06-tenant-isolation',
    'The empty workspace, while another holds thousands of rows',
  );

  const members = await page.request.get(
    `${API_URL}/api/v1/organizations/${organizationId}/members`,
  );
  qa.check('the reader can list their own members', members.ok(), `HTTP ${members.status()}`);
  if (members.ok()) {
    const body = (await members.json()) as { data?: unknown[]; items?: unknown[] } | unknown[];
    const rows = Array.isArray(body) ? body : (body.data ?? body.items ?? []);
    qa.note(`the members endpoint returned ${rows.length} row(s)`);
    qa.check(
      "the members endpoint returns the reader's workspace, not the union of both",
      rows.length <= mine.members,
      `${rows.length} returned, the workspace holds ${mine.members}`,
    );
  }

  // Asking for the other tenant by id is the direct question, and the one a
  // scoped list can still get wrong.
  const foreign = await page.request.get(
    `${API_URL}/api/v1/organizations/${other?.organizationId}/members`,
  );
  qa.check(
    "another workspace's members are refused, not returned",
    foreign.status() === 403 || foreign.status() === 404,
    `HTTP ${foreign.status()}`,
  );

  const foreignInvitations = await page.request.get(
    `${API_URL}/api/v1/organizations/${other?.organizationId}/invitations`,
  );
  qa.check(
    "another workspace's invitations are refused, not returned",
    foreignInvitations.status() === 403 || foreignInvitations.status() === 404,
    `HTTP ${foreignInvitations.status()}`,
  );
});
