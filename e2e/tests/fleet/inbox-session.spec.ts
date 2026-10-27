import { expect, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { pairedHosts } from '../../support/fleet';
import { connectInstallation, createSession } from '../../support/sessions';
import { linkLive, signInAs } from '../../support/web';

/**
 * A session whose agent stops to ask comes to the Inbox: the runner reads the
 * question off the screen (the Claude manifest's `question` rule), the API
 * holds it `blocked` for 30 s and derives `waiting-on-you`, and the Inbox lists
 * it with a card that opens the session. The agent is the fleet's `claude`
 * shim, so the question is printed into its shell. Needs the console on
 * `WEB_URL`.
 */
test.describe.configure({ timeout: 240_000 });
test.use({ baseURL: WEB_URL });

test('a session waiting on an answer shows in the Inbox and opens from it', async ({ page }) => {
  const up = await fetch(WEB_URL).then(
    (response) => response.ok,
    () => false,
  );
  test.skip(!up, `the console is not running on ${WEB_URL}`);

  const { api, user } = await signedUpContext('fleetinbox');
  const installationId = await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'inbox');
  const sessionId = await createSession(api, box.id, installationId);

  let screen = '';
  page.on('websocket', (socket) => {
    if (!socket.url().includes('/relay/attach')) return;
    socket.on('framereceived', (frame) => {
      if (typeof frame.payload !== 'string') {
        screen = (screen + frame.payload.toString()).slice(-100_000);
      }
    });
  });

  await signInAs(page, user);
  await page.goto(`/sessions/${sessionId}`);
  await expect.poll(() => screen.includes('CLAUDE-SHIM argv='), { timeout: 120_000 }).toBe(true);
  await expect(linkLive(page)).toBeVisible();

  // What Claude Code draws when it stops for a permission.
  await page.locator('.xterm').first().click();
  await page.keyboard.type(
    "clear; printf 'Bash command\\n  pnpm generate:api-client\\n\\nDo you want to proceed?\\n  1. Yes\\n  2. No\\n'",
  );
  await page.keyboard.press('Enter');
  // tmux may draw a run of spaces as cursor moves, so read the drawn rows, not the stream.
  await expect(page.locator('.xterm-rows')).toContainText('Do you want to proceed?');

  // Blocked for 30 s before it counts as waiting on you.
  await page.goto('/inbox');
  const row = page.locator('[data-slot="inbox-row"]', { hasText: 'is waiting on you' });
  await expect(async () => {
    await page.reload();
    await expect(row).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 120_000, intervals: [5_000] });

  await row.click();
  const card = page.getByRole('link', { name: 'Open session' });
  await expect(card).toBeVisible();
  if (process.env.INBOX_SCREENS) {
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `../.screenshots/inbox-session-1440-${theme}.png` });
    }
  }

  await card.click();
  await expect(page).toHaveURL(new RegExp(`/sessions/${sessionId}`));
});
