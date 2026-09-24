import { expect, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { pairedHosts } from '../../support/fleet';
import { connectInstallation, createSession } from '../../support/sessions';
import { signInAs } from '../../support/web';

/**
 * The console's terminal on a real runner: the session route mounts xterm over
 * `SessionsService.openStream`, the attach socket goes live, keystrokes go out
 * as bytes and come back as the shell's echo, and the console tells the relay
 * its size and credits what it drew. Needs the console on `WEB_URL`.
 */
test.describe.configure({ timeout: 180_000 });
// The fleet project's base is the API; this spec's pages are the console's.
test.use({ baseURL: WEB_URL });

test('the console streams a live session from a real runner', async ({ page }) => {
  const up = await fetch(WEB_URL).then(
    (response) => response.ok,
    () => false,
  );
  test.skip(!up, `the console is not running on ${WEB_URL}`);

  const { api, user } = await signedUpContext('fleetconsole');
  const installationId = await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'console');
  const sessionId = await createSession(api, box.id, installationId);

  // What crosses the attach socket: the tail of the screen one way, parsed
  // control frames the other.
  let screen = '';
  const controls: { type?: string }[] = [];
  page.on('websocket', (socket) => {
    if (!socket.url().includes('/relay/attach')) return;
    socket.on('framereceived', (frame) => {
      if (typeof frame.payload !== 'string') {
        screen = (screen + frame.payload.toString()).slice(-100_000);
      }
    });
    socket.on('framesent', (frame) => {
      if (typeof frame.payload !== 'string') return;
      try {
        controls.push(JSON.parse(frame.payload));
      } catch {}
    });
  });

  await signInAs(page, user);
  await page.goto(`/sessions/${sessionId}`);
  await expect.poll(() => screen.includes('CLAUDE-SHIM argv='), { timeout: 120_000 }).toBe(true);
  await expect(page.getByText('Live')).toBeVisible();

  await page.locator('.xterm').first().click();
  await page.keyboard.type('echo console-$((6*7))');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen.includes('console-42')).toBe(true);

  expect(controls.some((frame) => frame.type === 'resize')).toBe(true);
  expect(controls.some((frame) => frame.type === 'credit')).toBe(true);
});
