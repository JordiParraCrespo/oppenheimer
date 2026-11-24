import { expect, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { pairedHosts } from '../../support/fleet';
import { connectInstallation, createSession } from '../../support/sessions';
import { linkLive, signInAs } from '../../support/web';

/**
 * Every agent a session can start says when it waits on the person, and the
 * Inbox shows it within seconds. Each case prints, into its agent's shim, the
 * lines the real CLI draws for an approval (Codex 0.171, OpenCode 1.19.6,
 * captured in tmux on 2026-11-23, kept whole in the runner's manifest
 * testdata). Before then neither ever reached the Inbox: Codex's approval
 * matched none of its manifest's phrases and OpenCode had no blocked rule.
 */
test.describe.configure({ timeout: 240_000 });
test.use({ baseURL: WEB_URL });

const waits = [
  {
    agent: 'codex',
    screen: [
      '• Running touch /etc/oppenheimer-probe',
      '  Would you like to run the following command?',
      '  Reason: Create a probe file in /etc?',
      '  $ touch /etc/oppenheimer-probe',
      '› 1. Yes, proceed (y)',
      "  2. Yes, and don't ask again for commands that start with `touch /etc/oppenheimer-probe` (p)",
      '  3. No, and tell Codex what to do differently (esc)',
      '  Press enter to confirm or esc to cancel',
    ],
  },
  {
    agent: 'opencode',
    screen: [
      '  ┃  △ Permission required',
      '  ┃    # Shell command',
      '  ┃  $ touch /tmp/oc-probe',
      '  ┃   Allow once   Allow always   Reject          ctrl+f fullscreen  ⇆ select  enter confirm',
    ],
  },
] as const;

for (const { agent, screen } of waits) {
  test(`a ${agent} session waiting on an approval shows in the Inbox within seconds`, async ({
    page,
  }) => {
    const up = await fetch(WEB_URL).then(
      (response) => response.ok,
      () => false,
    );
    test.skip(!up, `the console is not running on ${WEB_URL}`);

    const { api, user } = await signedUpContext(`fleet${agent}wait`);
    const installationId = await connectInstallation(api);
    const [box] = await pairedHosts(api, 1, `${agent}-wait`);
    const sessionId = await createSession(api, box.id, installationId, { agent });

    await signInAs(page, user);
    const inbox = await page.context().newPage();
    await inbox.goto('/inbox');
    await expect(inbox.locator('[data-slot="inbox-list-head"]')).toBeVisible({ timeout: 30_000 });
    const row = inbox.locator('[data-slot="inbox-row"]', { hasText: 'is waiting on you' });
    await expect(row).toHaveCount(0);

    await page.bringToFront();
    await page.goto(`/sessions/${sessionId}`);
    await expect(page.locator('.xterm-rows')).toContainText('$', { timeout: 120_000 });
    await expect(linkLive(page)).toBeVisible();
    await page.locator('.xterm').first().click();
    const lines = screen.map((line) => line.replaceAll("'", "'\\''")).join('\\n');
    await page.keyboard.type(`clear; printf '${lines}\\n'`);
    await page.keyboard.press('Enter');
    await expect(page.locator('.xterm-rows')).toContainText(
      screen[screen.length - 1].trim().slice(0, 20),
    );

    const drawn = Date.now();
    await inbox.bringToFront();
    await expect(row).toBeVisible({ timeout: 25_000 });
    test
      .info()
      .annotations.push({ type: 'inbox-latency-ms', description: String(Date.now() - drawn) });
  });
}
