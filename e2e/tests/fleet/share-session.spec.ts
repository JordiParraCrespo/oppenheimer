import { type Browser, expect, type Page, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { newContext, signedUpContext, signIn, VALID_PASSWORD } from '../../support/auth';
import { query } from '../../support/db';
import { attach, pairedHosts } from '../../support/fleet';
import { connectInstallation, createSession } from '../../support/sessions';
import { signInAs } from '../../support/web';

/**
 * A session shared on a real runner, opened by people outside the
 * workspace: a second account named with write access types into the shell
 * and reads its echo back; shared again as a view-only link, a third account
 * sees the same screen and nothing it types reaches it (the relay drops the
 * frames, and tmux holds them as a read-only client). Needs the console on
 * `WEB_URL`.
 */
test.describe.configure({ timeout: 240_000 });
test.use({ baseURL: WEB_URL });

const SHOTS = process.env.SHARE_SESSION_SHOTS;

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

test('a named account types through a write share; a view-only link only watches', async ({
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
    const put = await owner.api.put(`/api/v1/sessions/${sessionId}/share`, {
      data,
      failOnStatusCode: false,
    });
    expect(put.status(), await put.text()).toBe(200);
    return ((await put.json()) as { slug: string }).slug;
  };

  // A second account, signed in to a workspace of its own, with a verified
  // email the share names.
  const guest = await signedUpContext('guest');
  await query(`UPDATE "user" SET "emailVerified" = true WHERE "id" = $1`, [guest.userId]);
  const slug = await share({
    audience: 'people',
    access: 'write',
    people: [guest.user.email],
    lifetime: '1h',
  });
  const typist = await holderPage(browser);
  const typistScreen = screenOf(typist);
  await signInAs(typist, guest.user);
  await typist.goto(`/s/${slug}`);
  await expect(typist.getByText('Can write')).toBeVisible();
  await expect
    .poll(() => typistScreen().includes('CLAUDE-SHIM argv='), { timeout: 120_000 })
    .toBe(true);
  await typist.locator('.xterm').first().click();
  await typist.keyboard.type('echo guest-$((6*7))');
  await typist.keyboard.press('Enter');
  await expect.poll(() => typistScreen().includes('guest-42'), { timeout: 30_000 }).toBe(true);
  if (SHOTS) await typist.screenshot({ path: `${SHOTS}/real-write-second-account.png` });

  // Shared again, at the same address, as a link that only watches; a third
  // account opens it.
  expect(await share({ audience: 'link', access: 'read', lifetime: '1h' })).toBe(slug);
  const viewer = await signedUpContext('viewer');
  const viewerApi = await newContext();
  expect((await signIn(viewerApi, viewer.user.email, VALID_PASSWORD)).status()).toBe(200);
  const watcher = await holderPage(browser);
  const watcherScreen = screenOf(watcher);
  await signInAs(watcher, viewer.user);
  await watcher.goto(`/s/${slug}`);
  await expect(watcher.getByText('View only', { exact: true })).toBeVisible();
  await expect.poll(() => watcherScreen().includes('guest-42'), { timeout: 30_000 }).toBe(true);
  await watcher.locator('.xterm').first().click();
  await watcher.keyboard.type('echo watcher-$((7*7))');
  await watcher.keyboard.press('Enter');

  // The console's read-only pane sends no keys at all, so also go round it:
  // a raw socket through the same share sends keystroke frames, which the
  // relay must drop (and tmux, attached read-only, would ignore).
  const raw = await attach(viewerApi, sessionId, { sharedSlug: slug });
  raw.send('echo raw-$((9*9))\r');

  // Proof the session is still live and answering: the owner's next line
  // arrives on the watchers' screens, and neither watcher's line reached the
  // shell.
  const member = await attach(owner.api, sessionId);
  member.send('echo after-$((8*8))\r');
  await expect.poll(() => watcherScreen().includes('after-64'), { timeout: 30_000 }).toBe(true);
  await raw.waitFor('after-64');
  for (const screen of [watcherScreen(), raw.screen(), member.screen()]) {
    expect(screen).not.toContain('watcher-49');
    expect(screen).not.toContain('raw-81');
  }
  await raw.close();
  await member.close();
  if (SHOTS) await watcher.screenshot({ path: `${SHOTS}/real-read-link.png` });
});
