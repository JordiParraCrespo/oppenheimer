import { expect, test } from '@playwright/test';
import { STUB_KEY_PREFIX } from '../../support/cursor-stub';
import { connectInstallation, STUB_REPOSITORIES } from '../../support/sessions';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * A cloud session in a browser, on the Cursor stub (`support/cursor-stub.ts`),
 * as `NewSessionComposer.dc.html` and `SessionsConsole.dc.html` draw it: the
 * key is connected in Settings → Cloud agents; New session's place chip lists
 * Cursor under Cloud beside the hosts; a session started there opens the
 * agent in Cursor in a tab of its own and is listed with the other sessions,
 * its row leading with Cursor's mark and opening Cursor; its page follows the
 * run to its end. The API's own spec covers the refusals; this holds the
 * console's wiring: the pickers, the send, the row and the poll.
 */
test('starts a session in Cursor’s cloud from New session and follows it', async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  const owner = await provisionedUser('cloud-web');
  await connectInstallation(owner.api);
  // Cursor's own page is not on this machine: the tab the start opens lands here.
  await context.route('https://cursor.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Cursor</title>' }),
  );
  await signInAs(page, owner.user);

  // ── The key, in Settings ──────────────────────────────────────────────────
  await page.goto('/settings/cloud-agents');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.getByLabel('API key').fill(`${STUB_KEY_PREFIX}9f3a`);
  await page.getByRole('dialog').getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(page.getByText('Stub key · stub@cursor.test · ending 9f3a')).toBeVisible();

  // ── Where it runs: Cursor, under Cloud ────────────────────────────────────
  await page.goto('/sessions/new');
  await page.getByRole('button', { name: 'Host' }).click();
  await page.getByRole('option', { name: 'Cursor' }).click();
  await expect(page.getByRole('button', { name: 'Host' })).toContainText('Cursor · Cloud');
  // No permission level in the cloud: the vendor's agent runs by its rules.
  await expect(page.getByRole('button', { name: 'Permission level' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Repositories' }).click();
  await page.getByRole('option', { name: new RegExp(STUB_REPOSITORIES.mobile.name) }).click();
  await page.keyboard.press('Escape');

  // ── The task, and the tab Cursor opens in ─────────────────────────────────
  const task = 'Fix the login redirect loop';
  await page.getByRole('textbox', { name: /Describe a task/ }).fill(task);
  const opened = context.waitForEvent('page');
  await page.getByRole('button', { name: /send/i }).click();
  const tab = await opened;
  await expect.poll(() => tab.url(), { timeout: 30_000 }).toContain('cursor.com/agents');

  // The console goes to the session, which has no terminal: it opens Cursor.
  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const sessionId = page.url().split('/').pop() as string;
  await expect(page.getByRole('link', { name: 'Open in Cursor' })).toHaveAttribute(
    'href',
    new RegExp(`bc-${sessionId}`),
  );

  // ── Listed with the others, its row opening Cursor ────────────────────────
  const row = page.locator(`a[href*="bc-${sessionId}"]`).first();
  await expect(row).toHaveAttribute('target', '_blank');

  // ── Followed to the end ───────────────────────────────────────────────────
  await expect(page.getByText('Finished in Cursor’s cloud', { exact: false })).toBeVisible({
    timeout: 40_000,
  });

  await owner.api.dispose();
});
