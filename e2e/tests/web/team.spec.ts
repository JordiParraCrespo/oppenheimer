import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { clickRowAction, provisionedUser, reloadFromServer, signInAs } from '../../support/web';

/**
 * The Team screen, end to end.
 *
 * Like every browser spec here, this creates what it asserts on — a workspace,
 * an invitation and a custom role — rather than leaning on seeded rows, so the
 * specs can run in parallel without contending over one roster.
 */

/** The row containing this text. */
function row(page: Page, text: string): Locator {
  return page.getByRole('row').filter({ hasText: text });
}

async function openTab(page: Page, name: 'Members' | 'Roles') {
  await page.getByRole('tab', { name: new RegExp(`^${name}`) }).click();
}

/**
 * Blocks until the screen has stopped loading — every one of its loading
 * surfaces. The organization query gates the page and renders a plain
 * "Loading…" paragraph; only once it resolves does a table mount and render
 * skeleton rows, which live in a `status` region and carry no text.
 */
function settled(page: Page) {
  return expect(page.getByText('Loading…').or(page.getByRole('status')).first()).toBeHidden({
    timeout: 30_000,
  });
}

async function openTeam(page: Page) {
  await page.goto('/team');
  await expect(page.getByRole('heading', { name: 'Team', level: 1 })).toBeVisible({
    timeout: 30_000,
  });
}

test('lists the owner, and counts the workspace', async ({ page }) => {
  const { user, api } = await provisionedUser('team');
  await signInAs(page, user);
  await openTeam(page);
  await settled(page);

  const owner = row(page, user.email);
  await expect(owner).toBeVisible();
  await expect(owner.getByText('Active')).toBeVisible();
  // The tab carries the count beside its name.
  await expect(page.getByRole('tab', { name: /^Members/ })).toContainText('1');

  await api.dispose();
});

test('invites a teammate, and the invitation survives a cold reload', async ({ page }) => {
  const { user, api } = await provisionedUser('teaminvite');
  const invitee = `e2e-invite-${Date.now()}@example.com`;
  await signInAs(page, user);
  await openTeam(page);

  await page.getByRole('button', { name: 'Invite', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Invite members' })).toBeVisible();

  await dialog.getByLabel('Email addresses').fill(invitee);
  await dialog.getByRole('button', { name: /^Send invite/ }).click();
  await expect(dialog).toBeHidden();

  // Nothing in storage to fall back on: this is what proves the invitation
  // reached the database rather than the list the mutation patched.
  await reloadFromServer(page);

  const invited = row(page, invitee);
  await expect(invited).toBeVisible({ timeout: 20_000 });
  // A pending invitation is a different thing from a member who has joined,
  // and the table says so rather than showing them as active.
  await expect(invited.getByText('Invited')).toBeVisible();

  // And it can be taken back through the row menu.
  await clickRowAction(page, invited, 'Cancel invitation');
  await expect(dialog.getByRole('heading', { name: 'Cancel this invitation?' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm' }).click();
  await expect(dialog).toBeHidden();

  await reloadFromServer(page);
  await settled(page);
  await expect(row(page, invitee)).toBeHidden({ timeout: 20_000 });

  await api.dispose();
});

test('rejects an address that is not one, before asking the server', async ({ page }) => {
  const { user, api } = await provisionedUser('teambademail');
  await signInAs(page, user);
  await openTeam(page);

  await page.getByRole('button', { name: 'Invite', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Email addresses').fill('not-an-email');
  await dialog.getByRole('button', { name: /^Send invite/ }).click();

  // The Zod schema's message, translated — not the server's English `detail`,
  // and not the browser's native validation bubble.
  await expect(dialog.getByRole('alert').first()).toBeVisible();
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Cancel' }).click();

  await api.dispose();
});

test('the members search is answered by the server, and the stats ignore it', async ({ page }) => {
  const { user, api } = await provisionedUser('teamsearch');
  await signInAs(page, user);
  await openTeam(page);
  await settled(page);

  const search = page.getByRole('searchbox').first();
  const membersTab = page.getByRole('tab', { name: /^Members/ });
  const memberCount = async () => (await membersTab.innerText()).replace(/\D/g, '');
  const before = await memberCount();
  expect(before).not.toBe('');

  await search.fill(user.email);
  await expect(row(page, user.email)).toBeVisible();
  // The request is debounced, so the URL is what says the search has been run
  // rather than merely typed.
  await expect(page).toHaveURL(/members_q=/);

  // Cold, so there is nothing in storage left to filter: a table still holding
  // the one row is a table the API answered.
  await reloadFromServer(page);
  await settled(page);
  await expect(search).toHaveValue(user.email, { timeout: 30_000 });
  await expect(row(page, user.email)).toBeVisible();

  // The count is the workspace's, not the search's.
  expect(await memberCount()).toBe(before);

  await search.fill('no-such-member-anywhere');
  await expect(page.getByText('No members match your filters.')).toBeVisible({
    timeout: 20_000,
  });

  await api.dispose();
});

test('creates a custom role, keeps it, and deletes it', async ({ page }) => {
  const { user, api } = await provisionedUser('teamrole');
  const roleName = `E2E role ${Date.now()}`;
  await signInAs(page, user);
  await openTeam(page);

  await openTab(page, 'Roles');
  // The tab travels in the URL with the two tables' own search and page.
  await expect(page).toHaveURL(/tab=roles/);

  await page.getByRole('button', { name: 'New role' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'New custom role' })).toBeVisible();

  await dialog.getByLabel('Role name').fill(roleName);
  // Grant the first area "View" so the role carries at least one rule.
  await dialog.getByRole('button', { name: 'View', exact: true }).first().click();
  await dialog.getByRole('button', { name: 'Create role' }).click();
  await expect(dialog).toBeHidden();

  await reloadFromServer(page);
  await openTab(page, 'Roles');

  const created = row(page, roleName);
  await expect(created).toBeVisible({ timeout: 20_000 });
  // A role somebody made here, not one the seed installed.
  await expect(created.getByText('Custom')).toBeVisible();
  await expect(created).toContainText('0 members');

  await clickRowAction(page, created, 'Delete');
  await expect(dialog.getByRole('heading', { name: 'Delete this role?' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm' }).click();

  await reloadFromServer(page);
  await openTab(page, 'Roles');
  await expect(row(page, roleName)).toBeHidden({ timeout: 20_000 });

  await api.dispose();
});

test('exports the members the reader is looking at', async ({ page }) => {
  const { user, api } = await provisionedUser('teamexport');
  await signInAs(page, user);
  await openTeam(page);
  await settled(page);

  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();

  const download = await pending;
  expect(download.suggestedFilename()).toBe('members.csv');

  // The filename alone would pass on an empty file. Read it: the translated
  // header, the owner's row, and the ISO joined date the export keeps
  // machine-readable on purpose.
  const path = await download.path();
  const csv = readFileSync(path, 'utf8');
  const [header, ...rows] = csv.split('\n');

  expect(header).toBe('"Name","Email","Organization role","Status","Joined"');
  const ownerRow = rows.find((line) => line.includes(`"${user.email}"`));
  expect(ownerRow).toBeDefined();
  expect(ownerRow).toContain('"Active"');
  expect(ownerRow).toMatch(/"\d{4}-\d{2}-\d{2}T/);

  await api.dispose();
});
