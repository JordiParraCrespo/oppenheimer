import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Browser, chromium, expect, type Page, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { turnOnForEveryone } from '../../support/flags';
import { uniqueHostName, waitForHost } from '../../support/fleet';
import { startLocalHost } from '../../support/fleet-local';
import {
  browserOn,
  buildNetsim,
  enter,
  netsimAvailable,
  netsimDown,
  netsimUp,
  type Placement,
  place,
} from '../../support/netsim';
import {
  appendTranscript,
  expectChatFollows,
  expectChatOnTop,
  expectComposerClickable,
  transcriptEntry,
} from '../../support/session-chat';
import { connectInstallation, createSession, mintPairingToken } from '../../support/sessions';
import { linkLive, signInAs } from '../../support/web';

/**
 * The chat view of a session on a far host, on a slow link: the host behind
 * ADSL in Barcelona, the reader on 4G in Tokyo, the relay in Falkenstein —
 * on the relay and on the direct path. Turns arrive late and in bursts there,
 * so this is where the chat's following and its cover over the grid (which
 * keeps streaming under it) are held to what the fleet spec holds them to on
 * a local link, and where the composer's text still reaches the PTY.
 */
test.describe.configure({ timeout: 15 * 60_000 });

const RELAY: Placement = { location: 'falkenstein', access: 'datacenter' };
const HOST: Placement = { location: 'barcelona', access: 'adsl' };
const READER: Placement = { location: 'tokyo', access: '4g' };

async function screenText(page: Page): Promise<string> {
  return (await page.locator('.xterm-rows').textContent()) ?? '';
}

test('the chat reads and types over a far, slow link, on the relay and direct', async () => {
  test.skip(!process.env.E2E_NETSIM, 'set E2E_NETSIM=1 to run the network bench');
  test.skip(!netsimAvailable(), 'netsim needs Linux, root and /dev/net/tun');
  test.skip(process.env.FLEET_HOSTS !== 'local', 'netsim runs local hosts (FLEET_HOSTS=local)');

  const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
  buildNetsim(repoRoot);
  await netsimUp(
    RELAY,
    [3000, 3001, 9418],
    [
      { name: 'browser', placement: RELAY, ports: [3000, 3001] },
      { name: 'host-far', placement: HOST, ports: [3001, 9418] },
    ],
  );

  let browser: Browser | undefined;
  try {
    const { api, user } = await signedUpContext('netsimchat');
    await turnOnForEveryone(api, 'session_chat_view');
    const installationId = await connectInstallation(api);
    const name = uniqueHostName('host-far');
    const host = startLocalHost(name, await mintPairingToken(api, name), {
      enter: enter('host-far'),
    });
    const row = await waitForHost(api, host, true, 120_000);

    const chrome = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? chromium.executablePath();
    browser = await chromium.launch({ executablePath: browserOn('browser', chrome) });

    for (const path of ['relay', 'direct'] as const) {
      const sessionId = await createSession(api, row.id, installationId);
      const append = (lines: string[]) => appendTranscript(host, sessionId, lines);
      append([transcriptEntry('user', 'u1', `Hello from Tokyo over the ${path}`)]);

      // The page loads next to the relay; the far link applies once it is live.
      await place('browser', RELAY);
      const context = await browser.newContext({
        baseURL: WEB_URL,
        viewport: { width: 1280, height: 760 },
      });
      const page = await context.newPage();
      await page.addInitScript(() => localStorage.setItem('oppenheimer.terminal.latency', '1'));
      if (path === 'relay') {
        await page.addInitScript(() => {
          // No WebRTC in this tab: the console stays on the relay.
          Object.defineProperty(window, 'RTCPeerConnection', { value: undefined });
        });
      }
      await signInAs(page, user);
      await page.goto(`/sessions/${sessionId}`);
      await expect(linkLive(page)).toBeVisible({ timeout: 120_000 });
      await expect(page.getByText(`· ${path}`)).toBeVisible({ timeout: 60_000 });
      await place('browser', READER);

      const toggle = page.getByRole('group', { name: 'How to read this session' });
      await expect(toggle).toBeVisible({ timeout: 60_000 });
      await toggle.getByRole('button', { name: 'Chat' }).click();
      await expect(
        page.locator('[data-slot="chat-user-message"]', {
          hasText: `Hello from Tokyo over the ${path}`,
        }),
      ).toBeVisible({ timeout: 30_000 });

      await expectChatOnTop(page);
      await expectChatFollows(page, append);
      await expectChatOnTop(page);

      const composer = await expectComposerClickable(page);
      await composer.fill(`echo far-${path}-$((6*7))`);
      await page.keyboard.press('Enter');
      await toggle.getByRole('button', { name: 'Terminal' }).click();
      await expect.poll(() => screenText(page), { timeout: 30_000 }).toContain(`far-${path}-42`);
      await expect(page.getByText(`· ${path}`)).toBeVisible();
      await page.screenshot({ path: `test-results/netsim-chat-${path}.png` });
      await context.close();
    }
  } finally {
    await browser?.close();
    netsimDown();
  }
});
