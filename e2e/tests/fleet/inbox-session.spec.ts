import { expect, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { pairedHosts } from '../../support/fleet';
import { connectInstallation, createSession } from '../../support/sessions';
import { linkLive, signInAs } from '../../support/web';

/**
 * A session whose agent stops to ask comes to the Inbox: the runner reads the
 * question off the screen (the Claude manifest's `question` rule), the API
 * derives `waiting-on-you` once a second report confirms the block, and the Inbox lists
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
  // The shim's shell prompt: its argv line may have scrolled out of what the
  // attach replays, so the marker on it is not waited for.
  await expect(page.locator('.xterm-rows')).toContainText('$', { timeout: 120_000 });
  await expect(linkLive(page)).toBeVisible();

  // The Inbox is open in a second tab before the agent asks, and is never
  // reloaded: the row has to arrive on its own, as it would for a person
  // looking at the Inbox while an agent works.
  const inbox = await page.context().newPage();
  await inbox.goto('/inbox');
  const row = inbox.locator('[data-slot="inbox-row"]', { hasText: 'is waiting on you' });
  await expect(inbox.locator('[data-slot="inbox-list-head"]')).toBeVisible({ timeout: 30_000 });
  await expect(row).toHaveCount(0);

  // What Claude Code draws when it stops for a permission.
  await page.bringToFront();
  await page.locator('.xterm').first().click();
  await page.keyboard.type(
    "clear; printf 'Bash command\\n  pnpm generate:api-client\\n\\nDo you want to proceed?\\n  1. Yes\\n  2. No\\n'",
  );
  await page.keyboard.press('Enter');
  // tmux may draw a run of spaces as cursor moves, so read the drawn rows, not the stream.
  await expect(page.locator('.xterm-rows')).toContainText('Do you want to proceed?');

  // Waiting on you once the runner confirms the block: up to 10 s for its loop
  // to see the screen, 3 s to confirm, and the event stream's refetch. Until
  // 2026-11-23 this took about a minute and needed a reload to show.
  const drawn = Date.now();
  await inbox.bringToFront();
  await expect(row).toBeVisible({ timeout: 25_000 });
  test
    .info()
    .annotations.push({ type: 'inbox-latency-ms', description: String(Date.now() - drawn) });

  await row.click();
  const card = inbox.getByRole('link', { name: 'Open session' });
  await expect(card).toBeVisible();
  if (process.env.INBOX_SCREENS) {
    for (const theme of ['light', 'dark'] as const) {
      await inbox.emulateMedia({ colorScheme: theme });
      await inbox.waitForTimeout(300);
      await inbox.screenshot({ path: `../.screenshots/inbox-session-1440-${theme}.png` });
    }
  }

  await card.click();
  await expect(inbox).toHaveURL(new RegExp(`/sessions/${sessionId}`));
});
