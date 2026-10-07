import { expect, type Page, test } from '@playwright/test';
import { connectInstallation, GITHUB_STUB_URL } from '../../support/sessions';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Pull requests, in a browser, against the real control plane: the queue read
 * live from GitHub through the workspace's installation, a briefing, its
 * changes and description, a review that approves and merges in the user's
 * name, a merge from the queue, and analytics.
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

  test('the queue, a briefing, a review that merges, a merge from the queue, analytics', async ({
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
    await page.getByRole('button', { name: /^Deep \d/ }).click();
    await expect(rowButton(page, 'Store wallet tokens in the Keychain')).toBeVisible();
    await expect(rowButton(page, 'Write down the release checklist')).toHaveCount(0);
    await page.getByRole('button', { name: /^All \d/ }).click();

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
    // Its conversation: the commit, the review asked of the viewer, and both comments.
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible();
    await expect(page.getByText('1 commit', { exact: true })).toBeVisible();
    await expect(page.getByText('lucia-m requested a review from ana-dev')).toBeVisible();
    await expect(page.getByText('archived accounts are filtered out first')).toBeVisible();
    await expect(page.getByText('@ana-dev').first()).toBeVisible();

    // Its briefing.
    await page.getByRole('button', { name: 'Briefing' }).click();
    await expect(page).toHaveURL(/view=briefing/);
    await expect(page.getByText('Path to merge')).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByText('The wallet screen showed a spinner forever').first(),
    ).toBeVisible();

    // Its changes, from GitHub's patch.
    await page.getByRole('button', { name: /^Changes/ }).click();
    await expect(page).toHaveURL(/view=changes/);
    await expect(page.getByText('src/screens/wallet/EmptyWallet.tsx').first()).toBeVisible({
      timeout: 30_000,
    });

    // ── Approve and merge, as the user ───────────────────────────────────────
    await page.getByRole('button', { name: /Submit review/ }).click();
    await page.getByRole('radio', { name: /Approve and merge/ }).click();
    await page.getByRole('button', { name: 'Approve and merge', exact: true }).click();
    await expect(page.getByText('Approved and merged.')).toBeVisible({ timeout: 30_000 });

    // ── Merge from the queue ─────────────────────────────────────────────────
    await page.goto('/pulls');
    const row = page.getByRole('row').filter({ hasText: 'Write down the release checklist' });
    await row.getByRole('button', { name: 'Merge' }).click();
    await row.getByRole('button', { name: 'Confirm merge' }).click();
    await expect(page.getByText(/Merged .*#16/)).toBeVisible({ timeout: 30_000 });
    // ── Watched repositories: none until picked, searched, a chip each ───────
    // Watching starts empty: nothing is watched until the reader picks it.
    await page.getByRole('button', { name: /^Watching/ }).click();
    const held = page.getByRole('row').filter({ hasText: 'Migrate the sessions table' });
    await expect(page.getByText('You are not watching any repositories')).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Watch repositories' }).click();
    await page.getByRole('textbox', { name: 'Search repositories' }).fill('web');
    await page.getByRole('option', { name: 'acme-labs/xrp-web' }).click();
    await page.keyboard.press('Escape');
    const unwatch = page.getByRole('button', { name: 'Stop watching acme-labs/xrp-web' });
    await expect(unwatch).toBeVisible({ timeout: 30_000 });
    // What holds a row names itself; the conflicted migration cannot merge.
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
    await page.goto('/pulls');
    await page.getByRole('button', { name: /^Watching/ }).click();
    await unwatch.click();
    await expect(held).toHaveCount(0, { timeout: 30_000 });
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
