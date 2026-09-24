import { expect, test } from '@playwright/test';
import { createSession, localHost, ownerContext } from '../../support/local-host';
import { signInAs } from '../../support/web';

/**
 * The console's terminal in Chromium, on the stack's real runner: the session
 * route mounts xterm over `SessionsService.openStream`, the attach socket goes
 * live, keystrokes go out as bytes and come back as the shell's echo, and the
 * console credits what it drew. Needs `stack.mjs up --web`.
 */
test('the console streams a live session from a real runner', async ({ page }) => {
  const host = localHost();
  const api = await ownerContext(host);
  const sessionId = await createSession(api, host);

  let received = '';
  const sent: string[] = [];
  page.on('websocket', (socket) => {
    if (!socket.url().includes('/relay/attach')) return;
    socket.on('framereceived', (frame) => {
      if (typeof frame.payload !== 'string') received += frame.payload.toString();
    });
    socket.on('framesent', (frame) => {
      if (typeof frame.payload === 'string') sent.push(frame.payload);
    });
  });

  await signInAs(page, { email: host.email, password: host.password });
  await page.goto(`/sessions/${sessionId}`);
  await expect.poll(() => received.includes('CLAUDE-SHIM argv='), { timeout: 120_000 }).toBe(true);
  await expect(page.getByText('Live')).toBeVisible();

  await page.locator('.xterm').first().click();
  await page.keyboard.type('echo console-$((6*7))');
  await page.keyboard.press('Enter');
  await expect.poll(() => received.includes('console-42')).toBe(true);

  expect(sent.some((frame) => frame.startsWith('{"type":"resize"'))).toBe(true);
  expect(sent.some((frame) => frame.startsWith('{"type":"credit"'))).toBe(true);
});
