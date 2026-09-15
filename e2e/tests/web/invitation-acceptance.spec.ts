import { expect, test } from '@playwright/test';
import { newUser, signedUpContext } from '../../support/auth';
import { inviteByApi, provisionedUser, signInAs } from '../../support/web';

/**
 * Invitation links are `/accept-invitation?id&email&role&inviter`. A person
 * with no account registers from the link and the acceptance completes in the
 * same submission; a person who already has one signs in and is brought back
 * to the same link to finish.
 */

function invitationLink(id: string, email: string, inviter: string, role = 'member') {
  const params = new URLSearchParams({ id, email, role, inviter });
  return `/accept-invitation?${params.toString()}`;
}

test.setTimeout(90_000);

test('a newcomer registers from the link and joins in one step', async ({ page }) => {
  const owner = await provisionedUser('inviter');
  const invitee = newUser('invitee');
  const invitationId = await inviteByApi(owner.api, owner.organizationId, invitee.email);

  await page.goto(invitationLink(invitationId, invitee.email, owner.user.name));

  await expect(page.getByRole('heading', { name: /join the workspace/i })).toBeVisible();
  await expect(page.getByText(`${owner.user.name} invited you`)).toBeVisible();
  // The address is the invitation's, not the reader's to change.
  await expect(page.locator('#email')).toHaveValue(invitee.email);
  await expect(page.locator('#email')).toHaveAttribute('readonly', '');

  await page.getByLabel('Full name').fill('Lucía Ferrer');
  await page.getByLabel('Create password').fill(invitee.password);
  await page.getByRole('button', { name: /create account & join/i }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

  // The membership is real: the owner's roster lists the new member.
  const members = await owner.api.get(`/api/v1/organizations/${owner.organizationId}/members`);
  expect(members.ok()).toBe(true);
  const rows = (await members.json()) as Array<{ role: string; user: { email: string } | null }>;
  expect(rows).toContainEqual(
    expect.objectContaining({
      role: 'member',
      user: expect.objectContaining({ email: invitee.email }),
    }),
  );

  await owner.api.dispose();
});

test('an existing account signs in and is returned to the same link to accept', async ({
  page,
}) => {
  const owner = await provisionedUser('inviter2');
  const { api: inviteeApi, user: invitee } = await signedUpContext('existing');
  await inviteeApi.dispose();
  const invitationId = await inviteByApi(owner.api, owner.organizationId, invitee.email, 'admin');
  const link = invitationLink(invitationId, invitee.email, owner.user.name, 'admin');

  await page.goto(link);
  await page.getByRole('link', { name: 'Sign in' }).click();

  // The login screen is prefilled with the invited address and remembers the
  // link, so signing in lands back here rather than on the dashboard.
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('#email')).toHaveValue(invitee.email);
  await page.fill('#password', invitee.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page).toHaveURL(/\/accept-invitation/, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Join workspace' }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

  const session = await page.request.get('/api/auth/get-session');
  const body = (await session.json()) as { session: { activeOrganizationId: string } };
  expect(body.session.activeOrganizationId).toBe(owner.organizationId);

  await owner.api.dispose();
});

test('a link missing its invitation says so instead of offering a dead form', async ({ page }) => {
  await page.goto('/accept-invitation');

  await expect(page.getByText(/invitation link is incomplete/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /create account & join/i })).toBeDisabled();
});

test('an owner who opens their own workspace invitation link is not bounced away', async ({
  page,
}) => {
  // A signed-in reader on `/accept-invitation` stays there: it is the one
  // auth-layout route an authenticated session may open.
  const owner = await provisionedUser('inviter3');
  await signInAs(page, owner.user);

  await page.goto(invitationLink('00000000-0000-0000-0000-000000000000', owner.user.email, 'X'));
  await expect(page).toHaveURL(/\/accept-invitation/);
  await expect(page.getByRole('button', { name: 'Join workspace' })).toBeVisible();

  await owner.api.dispose();
});
