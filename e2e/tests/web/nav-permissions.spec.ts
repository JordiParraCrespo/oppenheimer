import { expect, type Page, test } from '@playwright/test';
import { signedUpContext } from '../../support/auth';
import { inviteByApi, provisionedUser, signInAs } from '../../support/web';

/**
 * The sidebar shows only the routes the signed-in user's permissions can reach,
 * end to end. Each row's visibility is decided by the same effective ability the
 * API's `PoliciesGuard` checks (served by `GET /users/me/permissions`), so this
 * asserts against the real permission set of two accounts — not a stub.
 *
 * A workspace's owner holds the org-scoped owner role and sees the whole nav. A
 * plain member holds only the default `user` role, which grants nothing on
 * `Member`, so Team is hidden — not merely disabled. Sessions and Settings
 * declare no policy: a workspace is personal, and every user manages their
 * own API tokens.
 */

/** The primary nav landmark, addressed by its accessible name. */
function primaryNav(page: Page) {
  return page.getByRole('navigation', { name: 'Main navigation' });
}

test('an owner sees every route', async ({ page }) => {
  const owner = await provisionedUser('navowner');
  await signInAs(page, owner.user);

  const nav = primaryNav(page);
  for (const label of ['Dashboard', 'Team', 'Settings']) {
    await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
  }

  await owner.api.dispose();
});

test('a plain member sees only the routes they can reach', async ({ page }) => {
  const owner = await provisionedUser('navowner2');
  const { api: memberApi, user: member } = await signedUpContext('navmember');
  const invitationId = await inviteByApi(owner.api, owner.organizationId, member.email);
  const accepted = await memberApi.post(`/api/v1/invitations/${invitationId}/accept`);
  expect(accepted.ok()).toBe(true);
  await memberApi.dispose();

  await signInAs(page, member);

  const nav = primaryNav(page);
  await expect(nav.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Settings', exact: true })).toBeVisible();
  // Gone, not disabled: a row that can only answer 403 is a row nobody should
  // be offered.
  await expect(nav.getByRole('link', { name: 'Team', exact: true })).toHaveCount(0);

  await owner.api.dispose();
});

test('the command palette offers the same destinations as the sidebar', async ({ page }) => {
  const owner = await provisionedUser('navpalette');
  await signInAs(page, owner.user);

  await page.getByRole('button', { name: 'Search' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for (const label of ['Dashboard', 'Team', 'Settings']) {
    await expect(dialog.getByRole('option', { name: label })).toBeVisible();
  }

  await dialog.getByRole('option', { name: 'Team' }).click();
  await expect(page).toHaveURL(/\/team/);

  await owner.api.dispose();
});
