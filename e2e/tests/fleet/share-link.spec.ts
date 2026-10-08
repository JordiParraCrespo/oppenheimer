import { type Browser, expect, type Page, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { attach, pairedHosts } from '../../support/fleet';
import { connectInstallation, createSession } from '../../support/sessions';
import { signInAs } from '../../support/web';

/**
 * A session shared with a link, on a real runner, opened by people outside
 * the workspace: a second account through a `write` link types into the
 * shell and reads its echo back; somebody signed out, through a `read` link,
 * sees the same screen and nothing they type reaches it (the relay drops the
 * frames, and tmux holds them as a read-only client). Needs the console on
 * `WEB_URL`.
 */
test.describe.configure({ timeout: 240_000 });
test.use({ baseURL: WEB_URL });

const SHOTS = process.env.SHARE_LINK_SHOTS;

/** What the attach socket carries to the page, as text, for asserting on. */
function screenOf(page: Page): () => string {
  let screen = '';
  page.on('websocket', (socket) => {
    if (!socket.url().includes('/relay/attach')) return;
    socket.on('framereceived', (frame) => {
      if (typeof frame.payload !== 'string') {
        screen = (screen + frame.payload.toString()).slice(-100_000);
      }
    });
  });
  return () => screen;
}

async function holderPage(browser: Browser) {
  const context = await browser.newContext({
    baseURL: WEB_URL,
    viewport: { width: 1280, height: 720 },
  });
  return context.newPage();
}

test('a second account types through a write link; a read link only watches', async ({
  browser,
}) => {
  const up = await fetch(WEB_URL).then(
    (response) => response.ok,
    () => false,
  );
  test.skip(!up, `the console is not running on ${WEB_URL}`);

  const owner = await signedUpContext('sharer');
  const installationId = await connectInstallation(owner.api);
  const [box] = await pairedHosts(owner.api, 1, 'share');
  const sessionId = await createSession(owner.api, box.id, installationId);

  const share = async (data: Record<string, unknown>) => {
    const created = await owner.api.post(`/api/v1/sessions/${sessionId}/share-links`, {
      data,
      failOnStatusCode: false,
    });
    expect(created.status(), await created.text()).toBe(201);
    return ((await created.json()) as { token: string }).token;
  };
  const writeToken = await share({ access: 'write', audience: 'accounts', lifetime: '1d' });
  const readToken = await share({ access: 'read', audience: 'anyone', lifetime: '1h' });

  // A second account, signed in to a workspace of its own.
  const guest = await signedUpContext('guest');
  const typist = await holderPage(browser);
  const typistScreen = screenOf(typist);
  await signInAs(typist, guest.user);
  await typist.goto(`/shared#${writeToken}`);
  await expect(typist.getByText('You can type')).toBeVisible();
  await expect
    .poll(() => typistScreen().includes('CLAUDE-SHIM argv='), { timeout: 120_000 })
    .toBe(true);
  await typist.locator('.xterm').first().click();
  await typist.keyboard.type('echo guest-$((6*7))');
  await typist.keyboard.press('Enter');
  await expect.poll(() => typistScreen().includes('guest-42'), { timeout: 30_000 }).toBe(true);
  if (SHOTS) await typist.screenshot({ path: `${SHOTS}/real-write-second-account.png` });

  // Somebody signed out, through the read link: the same screen, no input.
  const watcher = await holderPage(browser);
  const watcherScreen = screenOf(watcher);
  await watcher.goto(`/shared#${readToken}`);
  await expect(watcher.getByText('Watching')).toBeVisible();
  await expect.poll(() => watcherScreen().includes('guest-42'), { timeout: 30_000 }).toBe(true);
  await watcher.locator('.xterm').first().click();
  await watcher.keyboard.type('echo watcher-$((7*7))');
  await watcher.keyboard.press('Enter');

  // The console's read-only pane sends no keys at all, so also go round it:
  // a raw socket through the same read link sends keystroke frames, which
  // the relay must drop (and tmux, attached read-only, would ignore).
  const raw = await attach(owner.api, sessionId, { sharedToken: readToken });
  raw.send('echo raw-$((9*9))\r');

  // Proof the session is still live and answering: the typist's next line
  // arrives on every screen, and neither watcher's line reached the shell.
  await typist.keyboard.type('echo after-$((8*8))');
  await typist.keyboard.press('Enter');
  await expect.poll(() => watcherScreen().includes('after-64'), { timeout: 30_000 }).toBe(true);
  await raw.waitFor('after-64');
  for (const screen of [typistScreen(), watcherScreen(), raw.screen()]) {
    expect(screen).not.toContain('watcher-49');
    expect(screen).not.toContain('raw-81');
  }
  await raw.close();
  if (SHOTS) await watcher.screenshot({ path: `${SHOTS}/real-read-signed-out.png` });
});
