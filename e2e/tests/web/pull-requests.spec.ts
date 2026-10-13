import { expect, type Page, test } from '@playwright/test';
import { connectInstallation, GITHUB_STUB_URL } from '../../support/sessions';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Pull requests, in a browser, against the real control plane: the queue read
 * live from GitHub through the workspace's installation and narrowed by its
 * facets, a pull request opening on its description and its changes and Back
 * to the description, a review that only approves and one that approves and
 * merges in the user's name, a merge from the queue, watched repositories set
 * in Settings, and analytics.
 *
 * Only GitHub is faked (`support/github-stub.ts`, `github-stub-pulls.ts`). The
 * stub's viewer is `ana-dev`, whose branches and sessions' `oppenheimer/…`
 * branches are "Mine". A merge changes the stub, so the suite resets it first.
 */
// Both describes drive one GitHub stub, whose pull requests and refusals are global: they take turns.
test.describe.configure({ mode: 'serial' });

test.describe('Pull requests', () => {
  test.beforeEach(async () => {
    const reset = await fetch(`${GITHUB_STUB_URL}/__stub/pulls/reset`, { method: 'POST' });
    expect(reset.ok, 'the GitHub stub resets its pull requests').toBe(true);
  });

  test('the queue, a description, a review that merges, a merge from the queue, analytics', async ({
    page,
  }) => {
    test.slow();
    const owner = await provisionedUser('pulls');
    await connectInstallation(owner.api);
    await signInAs(page, owner.user);

    // ── The queue: Mine is yours and your sessions' ──────────────────────────
    await page.getByRole('link', { name: 'Pull requests' }).first().click();
    await expect(page).toHaveURL(/\/pulls$/);
    await expect(page.getByRole('heading', { name: 'PR queue' })).toBeVisible();
    await expect(rowButton(page, 'Store wallet tokens in the Keychain')).toBeVisible({
      timeout: 30_000,
    });
    await expect(rowButton(page, 'Write down the release checklist')).toBeVisible();
    await expect(rowButton(page, 'Dark mode for the dashboard')).toBeVisible();
    // Somebody else's, asked of nobody: not here.
    await expect(rowButton(page, 'Bump react-native to 0.80')).toHaveCount(0);

    // Auth is a risky path, so the Keychain change is in the deep lane whatever its size.
    await page.getByRole('button', { name: /^Difficulty/ }).click();
    await page.getByRole('menuitemradio', { name: /^Deep/ }).click();
    await expect(page).toHaveURL(/lane=deep/);
    await expect(rowButton(page, 'Store wallet tokens in the Keychain')).toBeVisible();
    await expect(rowButton(page, 'Write down the release checklist')).toHaveCount(0);
    // Back from a pull request returns to the queue as it was left.
    await rowButton(page, 'Store wallet tokens in the Keychain').click();
    await page.getByRole('link', { name: 'Back to the queue' }).click();
    await expect(page).toHaveURL(/lane=deep/);
    await expect(rowButton(page, 'Write down the release checklist')).toHaveCount(0);
    await page.getByRole('button', { name: /^Difficulty/ }).click();
    await page.getByRole('menuitemradio', { name: /^All/ }).click();
    await expect(rowButton(page, 'Write down the release checklist')).toBeVisible();

    // ── Review requests ──────────────────────────────────────────────────────
    await page.getByRole('button', { name: /^Review requests/ }).click();
    await expect(rowButton(page, 'Fix the empty state on the wallet screen')).toBeVisible();
    await expect(rowButton(page, 'Rework the settings layout')).toBeVisible();

    // ── A pull request ───────────────────────────────────────────────────────
    await rowButton(page, 'Fix the empty state on the wallet screen').click();
    await expect(page).toHaveURL(/\/pulls\/[0-9a-f-]+\/\d+\/14$/);
    // It opens on its description, GitHub's Markdown as elements: no syntax, no template comment.
    await expect(page.getByRole('heading', { name: 'How to test' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByRole('listitem').filter({ hasText: 'shows the prompt' }).getByRole('checkbox'),
    ).toBeChecked();
    await expect(page.getByRole('cell', { name: 'Spinner' })).toBeVisible();
    await expect(page.getByText('What did you change')).toHaveCount(0);
    // Above it, the status strip: the gates and the way to the diff.
    await expect(page.getByRole('button', { name: 'Review changes' })).toBeVisible();
    await expect(page.getByText('Conflicts', { exact: true })).toBeVisible();
    // Two views only, and a link that still names the retired Briefing opens the description.
    await expect(page.getByRole('button', { name: 'Briefing' })).toHaveCount(0);
    await page.goto(`${page.url()}?view=briefing`);
    await expect(page.getByRole('heading', { name: 'How to test' })).toBeVisible({
      timeout: 30_000,
    });

    // Its changes, from GitHub's patch.
    await page.getByRole('button', { name: /^Changes/ }).click();
    await expect(page).toHaveURL(/view=changes/);
    await expect(page.getByText('src/screens/wallet/EmptyWallet.tsx').first()).toBeVisible({
      timeout: 30_000,
    });
    // Back from the changes is the pull request's bare address: its description.
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page).toHaveURL(/\/pulls\/[0-9a-f-]+\/\d+\/14$/);
    await expect(page.getByRole('heading', { name: 'How to test' })).toBeVisible();

    // ── Approve and merge, as the user ───────────────────────────────────────
    await page.getByRole('button', { name: /Submit review/ }).click();
    await page.getByRole('radio', { name: /^Approve and merge/ }).click();
    await page.getByRole('button', { name: 'Approve and merge', exact: true }).click();
    await expect(page.getByText('Approved and merged.')).toBeVisible({ timeout: 30_000 });

    // ── Approve alone leaves the merge to the reader ─────────────────────────
    await page.goto('/pulls?scope=requested');
    await rowButton(page, 'Rework the settings layout').click();
    await page.getByRole('button', { name: /Submit review/ }).click();
    await page.getByRole('radio', { name: /^Approve Approves as you/ }).click();
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(page.getByText('Approved.', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Merge', exact: true })).toBeVisible();

    // ── Merge from the queue ─────────────────────────────────────────────────
    await page.goto('/pulls');
    const row = page.getByRole('row').filter({ hasText: 'Write down the release checklist' });
    await row.getByRole('button', { name: 'Merge' }).click();
    await row.getByRole('button', { name: 'Confirm merge' }).click();
    await expect(page.getByText(/Merged .*#16/)).toBeVisible({ timeout: 30_000 });
    // ── Watched repositories: none until picked, in Settings ─────────────────
    // Watching starts empty: nothing is watched until the reader picks it.
    await page.getByRole('button', { name: /^Watching/ }).click();
    const held = page.getByRole('row').filter({ hasText: 'Migrate the sessions table' });
    await expect(page.getByText('You are not watching any repositories')).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('link', { name: 'Configure watched repositories' }).first().click();
    await expect(page).toHaveURL(/\/settings\/repositories$/);
    await page.getByRole('button', { name: 'Watch repositories' }).click();
    await page.getByRole('textbox', { name: 'Search repositories' }).fill('web');
    await page.getByRole('option', { name: 'acme-labs/xrp-web' }).click();
    await page.keyboard.press('Escape');
    const unwatch = page.getByRole('button', { name: 'Stop watching acme-labs/xrp-web' });
    await expect(unwatch).toBeVisible({ timeout: 30_000 });
    // What holds a row names itself; the conflicted migration cannot merge.
    await page.goto('/pulls?scope=watching');
    await expect(held.getByRole('button', { name: 'Merge' })).toBeDisabled({ timeout: 30_000 });

    // ── Analytics reads the picks ────────────────────────────────────────────
    // The sidebar's rows are the design system's routine items: list items that navigate.
    const analytics = page.locator('[data-slot="routine-item"]', { hasText: 'Analytics' });
    const merged = page
      .locator('[data-slot="chart-hero"]', { hasText: 'PRs merged' })
      .locator('.figures');
    await analytics.click();
    await expect(page).toHaveURL(/\/pulls\/analytics/);
    await expect(page.getByRole('heading', { name: 'Your review month' })).toBeVisible();
    // xrp-web's merged pull requests count only because it is watched.
    await expect(merged).toHaveText(/^[1-9]\d*$/, { timeout: 30_000 });
    await expect(page.getByText('Lane mix')).toBeVisible();

    // Unwatched, its pull requests leave the queue and the month.
    await page.goto('/settings/repositories');
    await unwatch.click();
    await expect(unwatch).toHaveCount(0, { timeout: 30_000 });
    await page.goto('/pulls?scope=watching');
    await expect(page.getByText('You are not watching any repositories')).toBeVisible({
      timeout: 30_000,
    });
    await expect(held).toHaveCount(0);
    await analytics.click();
    await expect(merged).toHaveText('0', { timeout: 30_000 });
  });
});

test.describe('Pull requests when GitHub answers in part', () => {
  test.beforeEach(async () => {
    const reset = await fetch(`${GITHUB_STUB_URL}/__stub/pulls/reset`, { method: 'POST' });
    expect(reset.ok, 'the GitHub stub resets its pull requests').toBe(true);
  });

  test.afterEach(async () => {
    await fetch(`${GITHUB_STUB_URL}/__stub/pulls/reset`, { method: 'POST' });
  });

  test('a repository whose checks GitHub refuses keeps its rows and says what to grant', async ({
    page,
  }) => {
    test.slow();
    // An installation without Checks: read, as met on a real one (#244).
    await fetch(`${GITHUB_STUB_URL}/__stub/checks-refused/acme-labs/xrp-mobile`, { method: 'PUT' });
    const owner = await provisionedUser('pullsrefused');
    await connectInstallation(owner.api);
    await signInAs(page, owner.user);

    await page.goto('/pulls');
    // The queue renders: the refused repository's rows and the other repository's alike.
    await expect(rowButton(page, 'Store wallet tokens in the Keychain')).toBeVisible({
      timeout: 30_000,
    });
    await expect(rowButton(page, 'Dark mode for the dashboard')).toBeVisible();
    await expect(page.getByText(/The GitHub App needs Checks: read/)).toBeVisible();
    const row = page.getByRole('row').filter({ hasText: 'Store wallet tokens in the Keychain' });
    await expect(row.getByText('Checks unavailable').first()).toBeVisible();
  });
});

function rowButton(page: Page, title: string) {
  return page.getByRole('button', { name: title, exact: true });
}
