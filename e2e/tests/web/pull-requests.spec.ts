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

    // ── A briefing ───────────────────────────────────────────────────────────
    await rowButton(page, 'Fix the empty state on the wallet screen').click();
    await expect(page).toHaveURL(/\/pulls\/[0-9a-f-]+\/\d+\/14/);
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
    // What holds a row names itself; the conflicted migration cannot merge.
    await page.getByRole('button', { name: /^Watching/ }).click();
    const held = page.getByRole('row').filter({ hasText: 'Migrate the sessions table' });
    await expect(held.getByRole('button', { name: 'Merge' })).toBeDisabled();

    // ── Analytics ────────────────────────────────────────────────────────────
    // The sidebar's rows are the design system's routine items: list items that navigate.
    await page.locator('[data-slot="routine-item"]', { hasText: 'Analytics' }).click();
    await expect(page).toHaveURL(/\/pulls\/analytics/);
    await expect(page.getByRole('heading', { name: 'Your review month' })).toBeVisible();
    await expect(page.getByText('PRs merged').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Lane mix')).toBeVisible();
  });
});

function rowButton(page: Page, title: string) {
  return page.getByRole('button', { name: title, exact: true });
}
