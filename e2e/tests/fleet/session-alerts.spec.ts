import { expect, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { pairedHosts } from '../../support/fleet';
import { connectInstallation, createSession } from '../../support/sessions';
import { linkLive, signInAs } from '../../support/web';

/**
 * The console tells a reader who is not looking. With "Notify me in this
 * browser" on, a console tab in the background raises a system notification
 * when a session comes to wait on them, and a click on it opens that session;
 * the tab in front, where the reader is, raises none. The browser's
 * `Notification` is recorded rather than shown, since a headless browser has
 * no desktop to show it on.
 */
test.describe.configure({ timeout: 240_000 });
test.use({ baseURL: WEB_URL });

declare global {
  interface Window {
    __alerts: { title: string; body?: string; tag?: string; click: () => void }[];
  }
}

test('a session that comes to wait raises a notification in a console tab in the background', async ({
  browser,
}) => {
  const up = await fetch(WEB_URL).then(
    (response) => response.ok,
    () => false,
  );
  test.skip(!up, `the console is not running on ${WEB_URL}`);

  const { api, user } = await signedUpContext('fleetalerts');
  const installationId = await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'alerts');
  const sessionId = await createSession(api, box.id, installationId);

  const context = await browser.newContext({ baseURL: WEB_URL });
  await context.grantPermissions(['notifications'], { origin: WEB_URL });
  await context.addInitScript(() => {
    window.__alerts = [];
    class Recorded {
      static permission: NotificationPermission = 'granted';
      static requestPermission = async (): Promise<NotificationPermission> => 'granted';
      onclick: (() => void) | null = null;
      constructor(title: string, options?: NotificationOptions) {
        window.__alerts.push({
          title,
          body: options?.body,
          tag: options?.tag,
          click: () => this.onclick?.(),
        });
      }
      close() {}
    }
    Object.defineProperty(window, 'Notification', { value: Recorded, configurable: true });
  });

  // Headless Chromium reports every tab visible and focused, whichever is in
  // front, so the tab behind says so itself: what a real browser reports for
  // a tab the reader is not looking at.
  const watcher = await context.newPage();
  await watcher.addInitScript(() => {
    Object.defineProperty(document, 'visibilityState', { get: () => 'hidden' });
    document.hasFocus = () => false;
  });
  await signInAs(watcher, user);
  await watcher.goto('/inbox');
  await watcher.getByRole('button', { name: 'Filter the Inbox' }).click();
  await watcher.getByRole('menuitemcheckbox', { name: 'Notify me in this browser' }).click();
  await expect(
    watcher.getByRole('menuitemcheckbox', { name: 'Notify me in this browser' }),
  ).toBeChecked();
  await watcher.keyboard.press('Escape');

  // The reader works in a second tab, in front; the first one is behind it.
  const typist = await context.newPage();
  await typist.goto(`/sessions/${sessionId}`);
  await expect(typist.locator('.xterm-rows')).toContainText('$', { timeout: 120_000 });
  await expect(linkLive(typist)).toBeVisible();
  await typist.locator('.xterm').first().click();
  await typist.keyboard.type(
    "clear; printf 'Bash command\\n  pnpm generate:api-client\\n\\nDo you want to proceed?\\n  1. Yes\\n  2. No\\n'",
  );
  await typist.keyboard.press('Enter');
  await expect(typist.locator('.xterm-rows')).toContainText('Do you want to proceed?');

  // The tab in the background tells; the one the reader types in does not.
  await expect
    .poll(() => watcher.evaluate(() => window.__alerts.map((alert) => alert.title)), {
      timeout: 30_000,
    })
    .toEqual([expect.stringContaining('is waiting on you')]);
  // The tab in front heard the same change through the same stream (the
  // console refetches at most every 2 s), and told nothing.
  await expect
    .poll(
      async () =>
        ((await (await api.get(`/api/v1/sessions/${sessionId}`)).json()) as { state: string })
          .state,
    )
    .toBe('waiting-on-you');
  await typist.waitForTimeout(3_000);
  expect(await typist.evaluate(() => window.__alerts.length)).toBe(0);

  await watcher.evaluate(() => window.__alerts[0]?.click());
  await expect(watcher).toHaveURL(new RegExp(`/sessions/${sessionId}`));
  await context.close();
});
