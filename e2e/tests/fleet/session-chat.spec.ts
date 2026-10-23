import { expect, type Page, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { turnOnForEveryone } from '../../support/flags';
import { pairedHosts } from '../../support/fleet';
import { STUB_TRANSCRIPT, tidied } from '../../support/namer-stub';
import {
  appendTranscript,
  transcriptEntry as entry,
  expectChatFollows,
  expectChatOnTop,
  expectComposerClickable,
} from '../../support/session-chat';
import { connectInstallation, createSession } from '../../support/sessions';
import { signInAs } from '../../support/web';

/**
 * A Claude Code session read as a chat (0.7), on a real runner: the host
 * follows the conversation's transcript where Claude Code keeps it, the relay
 * hands its entries to the attached browser, and the console draws them as
 * turns — the history first, then each line the CLI appends. What the chat's
 * composer sends is typed into the same PTY as the grid. The fleet's `claude`
 * is a shim, so the transcript is written here, line by line as the CLI
 * writes it. The composer takes dictation too: Chromium's fake microphone
 * records and the stack's speech stub hears its one sentence. Needs the
 * console on `WEB_URL`.
 */
test.describe.configure({ timeout: 180_000 });
test.use({
  baseURL: WEB_URL,
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
  permissions: ['microphone'],
});

async function screenText(page: Page): Promise<string> {
  return (await page.locator('.xterm-rows').textContent()) ?? '';
}

test('the console reads a Claude Code session as a chat, live, and types into its terminal', async ({
  page,
}) => {
  const up = await fetch(WEB_URL).then(
    (response) => response.ok,
    () => false,
  );
  test.skip(!up, `the console is not running on ${WEB_URL}`);

  const { api, user } = await signedUpContext('fleetchat');
  await turnOnForEveryone(api, 'session_chat_view');
  await turnOnForEveryone(api, 'voice_dictation');
  const installationId = await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'chat');
  const sessionId = await createSession(api, box.id, installationId);
  const append = (lines: string[]) => appendTranscript(box.host, sessionId, lines);
  append([
    entry('user', 'u1', 'Fix the empty wallet'),
    entry('assistant', 'a1', [
      { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'pnpm test wallet' } },
    ]),
    entry('user', 'r1', [
      { type: 'tool_result', tool_use_id: 't1', content: '1 failed', is_error: true },
    ]),
    entry('assistant', 'a2', [{ type: 'text', text: 'Found it: `reduce` had no initial value.' }]),
  ]);

  // The readout reaches over the grid at its own z-index; it is on here so
  // the chat is shown to cover it.
  await page.addInitScript(() => localStorage.setItem('oppenheimer.terminal.latency', '1'));
  await signInAs(page, user);
  await page.goto(`/sessions/${sessionId}`);
  const toggle = page.getByRole('group', { name: 'How to read this session' });
  await expect(toggle).toBeVisible({ timeout: 120_000 });
  await toggle.getByRole('button', { name: 'Chat' }).click();

  await expect(
    page.locator('[data-slot="chat-user-message"]').getByText('Fix the empty wallet'),
  ).toBeVisible();
  await expect(page.getByText('pnpm test wallet')).toBeVisible();
  await expect(page.getByText('had no initial value.')).toBeVisible();

  // A line the agent writes after the page opened arrives on its own.
  append([entry('assistant', 'a3', [{ type: 'text', text: 'Fixed and tested.' }])]);
  await expect(page.getByText('Fixed and tested.')).toBeVisible({ timeout: 15_000 });

  // Nothing of the grid under it reaches over the chat, and it scrolls as a chat does.
  await expectChatOnTop(page);
  await expectChatFollows(page, append);

  // Dictation lands in the composer, at the end of the draft, unsent.
  const composer = await expectComposerClickable(page);

  await composer.fill('First,');
  await page.getByRole('button', { name: 'Dictate' }).click();
  const recorder = page.locator('[data-slot="voice-recorder-bar"][data-state="recording"]');
  await expect(recorder.getByText('0:01')).toBeVisible({ timeout: 10_000 });
  await recorder.getByRole('button', { name: 'Stop recording' }).click();
  await expect(composer).toHaveValue(`First, ${tidied(STUB_TRANSCRIPT)}`, { timeout: 15_000 });

  // The composer types into the terminal: the shim's shell runs it.
  await composer.fill('echo chat-$((6*7))');
  await page.keyboard.press('Enter');
  await toggle.getByRole('button', { name: 'Terminal' }).click();
  await expect.poll(() => screenText(page), { timeout: 15_000 }).toContain('chat-42');
});

test('the chat covers a WebGL grid, and takes clicks over it', async ({ page }) => {
  const up = await fetch(WEB_URL).then(
    (response) => response.ok,
    () => false,
  );
  test.skip(!up, `the console is not running on ${WEB_URL}`);

  const { api, user } = await signedUpContext('fleetchatgl');
  await turnOnForEveryone(api, 'session_chat_view');
  const installationId = await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'chatgl');
  const sessionId = await createSession(api, box.id, installationId);
  appendTranscript(box.host, sessionId, [entry('user', 'u1', 'Fix the empty wallet')]);

  // Off Linux the grid draws with WebGL (`terminal-webgl-policy.ts`), and its
  // link layer is a canvas that takes the pointer: once it reached over the
  // chat, and nothing in the chat could be clicked.
  await page.addInitScript(() =>
    Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'MacIntel' }),
  );
  await signInAs(page, user);
  await page.goto(`/sessions/${sessionId}`);
  const toggle = page.getByRole('group', { name: 'How to read this session' });
  await expect(toggle).toBeVisible({ timeout: 120_000 });
  await expect(page.locator('.xterm canvas.xterm-link-layer')).toBeAttached();
  await toggle.getByRole('button', { name: 'Chat' }).click();
  await expect(page.locator('[data-slot="chat-user-message"]')).toBeVisible();

  await expectChatOnTop(page);
  await expectComposerClickable(page);
});

test('a guest on a view-only link reads the chat, with no composer', async ({ browser }) => {
  const up = await fetch(WEB_URL).then(
    (response) => response.ok,
    () => false,
  );
  test.skip(!up, `the console is not running on ${WEB_URL}`);

  const owner = await signedUpContext('chatsharer');
  await turnOnForEveryone(owner.api, 'session_chat_view');
  const installationId = await connectInstallation(owner.api);
  const [box] = await pairedHosts(owner.api, 1, 'chatshare');
  const sessionId = await createSession(owner.api, box.id, installationId);
  appendTranscript(box.host, sessionId, [
    entry('user', 'u1', 'Fix the empty wallet'),
    entry('assistant', 'a1', [{ type: 'text', text: 'Found it: `reduce` had no initial value.' }]),
  ]);
  const put = await owner.api.put(`/api/v1/sessions/${sessionId}/share`, {
    data: { audience: 'link', access: 'read', lifetime: '1h' },
    failOnStatusCode: false,
  });
  expect(put.status(), await put.text()).toBe(200);
  const { slug } = (await put.json()) as { slug: string };

  // Once the chat was never sent through a share, so a guest had the grid alone.
  const guest = await signedUpContext('chatguest');
  const page = await (await browser.newContext({ baseURL: WEB_URL })).newPage();
  await signInAs(page, guest.user);
  await page.goto(`/s/${slug}`);
  await expect(page.getByText('View only', { exact: true })).toBeVisible();
  const toggle = page.getByRole('group', { name: 'How to read this session' });
  await expect(toggle).toBeVisible({ timeout: 120_000 });
  await toggle.getByRole('button', { name: 'Chat' }).click();
  await expect(
    page.locator('[data-slot="chat-user-message"]').getByText('Fix the empty wallet'),
  ).toBeVisible();
  await expect(page.getByText('had no initial value.')).toBeVisible();
  await expectChatOnTop(page);
  await expect(page.getByRole('button', { name: 'Dictate' })).toHaveCount(0);
});
