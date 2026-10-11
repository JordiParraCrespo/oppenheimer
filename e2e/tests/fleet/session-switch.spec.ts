import { expect, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { pairedHosts } from '../../support/fleet';
import { connectInstallation, createSession } from '../../support/sessions';
import { signInAs } from '../../support/web';

/**
 * Switching back to a session in the console paints the screen it showed
 * last time, not "Nothing on the grid yet" while the link redials and tmux
 * redraws. The regression is a pane that remounts empty on every switch.
 * Both switches are the sidebar's links, as a reader makes them: a full page
 * load starts a new tab, which has nothing kept. Needs the console on
 * `WEB_URL`.
 */
test.describe.configure({ timeout: 240_000 });
test.use({ baseURL: WEB_URL });

const WAITING = 'Nothing on the grid yet';

test('switching back to a session shows its screen, not the waiting state', async ({ page }) => {
  const up = await fetch(WEB_URL).then(
    (response) => response.ok,
    () => false,
  );
  test.skip(!up, `the console is not running on ${WEB_URL}`);

  const { api, user } = await signedUpContext('fleetswitch');
  const installationId = await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'switch');
  const first = await createSession(api, box.id, installationId);
  const second = await createSession(api, box.id, installationId);

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
  await page.goto(`/sessions/${first}`);
  await expect.poll(() => screen.includes('CLAUDE-SHIM argv='), { timeout: 120_000 }).toBe(true);
  await expect(page.getByText(WAITING)).toBeHidden();

  // Over to the second session and let it draw, so the first pane unmounts
  // with a screen worth keeping and the second link is live in its place.
  screen = '';
  await page.locator(`a[href="/sessions/${second}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`/sessions/${second}$`));
  await expect.poll(() => screen.includes('CLAUDE-SHIM argv='), { timeout: 120_000 }).toBe(true);

  // Watch the whole way back: the waiting state must not show for a frame.
  await page.evaluate((text) => {
    const seen = { waiting: false };
    (window as unknown as { __switch: typeof seen }).__switch = seen;
    const look = () => {
      if (document.body.innerText.includes(text)) seen.waiting = true;
    };
    new MutationObserver(look).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }, WAITING);

  screen = '';
  await page.locator(`a[href="/sessions/${first}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`/sessions/${first}$`));
  await expect(page.locator('.xterm').first()).toBeVisible();
  // Past the redial, so the hand-over from the kept screen has happened too.
  await expect.poll(() => screen.length > 0, { timeout: 60_000 }).toBe(true);
  await expect(page.getByText('Live', { exact: true })).toBeVisible();

  const seen = await page.evaluate(
    () => (window as unknown as { __switch: { waiting: boolean } }).__switch,
  );
  expect(seen.waiting, 'the waiting state showed on the way back').toBe(false);
});
