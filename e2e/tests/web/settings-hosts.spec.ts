import { expect, test } from '@playwright/test';
import { pairHost } from '../../support/sessions';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Settings → Hosts, in a browser, against the real control plane
 * (`product/versions/mvp/14-hosts-settings.md`, `design/version1/Settings.dc.html`).
 *
 * The host is paired the way a runner pairs — its token spent anonymously —
 * but no runner dials in, so the card reads offline with no last-seen line: the
 * page is about what the control plane holds, and a live link is the fleet
 * suite's subject. The legs are the page's verbs: the account menu's way in,
 * the card, Rename in place, and Remove behind its confirm,
 * after which the host leaves the list and the timeline says why.
 */
test('lists, renames and removes a host from Settings', async ({ page }) => {
  test.slow();
  const owner = await provisionedUser('settingshosts');
  const hostId = await pairHost(owner.api, 'build-02');

  await signInAs(page, owner.user);

  // In from the account menu, the one place the console links Settings.
  await page
    .getByRole('button', { name: `${owner.user.firstName} ${owner.user.lastName}` })
    .click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();
  // Settings lands on Profile; Hosts is the Workspace row, with its count.
  const hostsRow = page.getByRole('link', { name: /Hosts/ });
  await expect(hostsRow).toContainText('1');
  await hostsRow.click();
  await expect(page).toHaveURL(/\/settings\/hosts$/);
  await expect(page.getByRole('heading', { name: 'Hosts', level: 1 })).toBeVisible();

  // The card: name, the runner's facts, and the state the API derived.
  const card = page.getByTestId('host-card');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('build-02');
  await expect(card).toContainText('runner 0.1.0');
  await expect(card).toContainText('Offline');

  // ── Rename in place ──────────────────────────────────────────────────────
  await card.getByRole('button', { name: 'build-02 actions' }).click();
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  const input = card.getByRole('textbox', { name: 'Host name' });
  await input.fill('');
  await input.pressSequentially('build 03');
  // Spaces become hyphens as you type: a host's name reads as a hostname.
  await expect(input).toHaveValue('build-03');
  await card.getByRole('button', { name: 'Save' }).click();
  await expect(card).toContainText('build-03');
  await expect(input).toBeHidden();
  // The card changes in place, somewhere in a list, so the rename says so too.
  await expect(
    page.locator('[data-sonner-toast]').filter({ hasText: 'Renamed to “build-03”.' }),
  ).toBeVisible();

  // ── Remove, behind its confirm ───────────────────────────────────────────
  await card.getByRole('button', { name: 'build-03 actions' }).click();
  await page.getByRole('menuitem', { name: 'Remove host' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Remove build-03?');
  await expect(dialog).toContainText(
    'No sessions are running on build-03. The runner’s token is revoked and automations targeting it are paused.',
  );
  await dialog.getByRole('button', { name: 'Remove host' }).click();

  await expect(page.getByTestId('host-card')).toHaveCount(0);
  await expect(page.getByText('No hosts yet')).toBeVisible();

  // What the page did is on the host's timeline, newest first.
  const timeline = await owner.api.get(`/api/v1/hosts/${hostId}/timeline`);
  expect(timeline.status()).toBe(200);
  const kinds = ((await timeline.json()) as { entries: { kind: string }[] }).entries.map(
    (entry) => entry.kind,
  );
  expect(kinds).toEqual(['unpaired', 'renamed', 'paired']);

  await owner.api.dispose();
});
