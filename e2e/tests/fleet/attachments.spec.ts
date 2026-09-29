import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { pairedHosts } from '../../support/fleet';
import { connectInstallation, STUB_REPOSITORIES } from '../../support/sessions';
import { signInAs } from '../../support/web';

/**
 * An image attached to the first task, end to end on a real runner: the
 * console stages it, the create claims it for the host, the runner pulls it
 * before it starts the agent, saves it outside the worktree and launches the
 * agent with its path after the task. The `claude` shim prints its argv, so
 * the terminal shows exactly what the agent was given.
 *
 * `SCREENSHOTS_DIR` keeps a picture of each step; unset, they go beside the
 * test's other output.
 */
test.describe.configure({ timeout: 240_000 });
test.use({ baseURL: WEB_URL });

test('an image attached to the first task reaches the agent with it', async ({
  page,
}, testInfo) => {
  const up = await fetch(WEB_URL).then(
    (response) => response.ok,
    () => false,
  );
  test.skip(!up, `the console is not running on ${WEB_URL}`);

  const shots = process.env.SCREENSHOTS_DIR ?? testInfo.outputDir;
  mkdirSync(shots, { recursive: true });
  const shot = (name: string) => page.screenshot({ path: join(shots, `${name}.png`) });

  const { api, user } = await signedUpContext('attach');
  await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'attach');

  await page.setViewportSize({ width: 1280, height: 800 });
  await signInAs(page, user);
  await page.goto('/sessions/new');
  await expect(page.getByRole('heading', { name: 'Ready when you are.' })).toBeVisible();
  await shot('1-new-session');

  await page.getByRole('button', { name: 'Host' }).click();
  await page.getByRole('option', { name: new RegExp(box.host.name) }).click();
  await page.getByRole('button', { name: 'Repositories' }).click();
  await page.getByRole('option', { name: new RegExp(STUB_REPOSITORIES.mobile.name) }).click();
  await page.keyboard.press('Escape');

  // A file over the cap is refused under the field, with the reason.
  const picker = page.locator('input[type="file"]');
  await picker.setInputFiles({
    name: 'too-big.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await expect(page.getByRole('alert')).toContainText('too-big.png is over 5 MB');
  await shot('2-refused-too-large');

  // A real PNG: a picture of the heading itself.
  const png = await page.getByRole('heading', { name: 'Ready when you are.' }).screenshot();
  await picker.setInputFiles({ name: 'mockup.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText('mockup.png', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: /Describe a task/ }).fill('Match this mockup');
  await shot('3-attached');

  let screen = '';
  page.on('websocket', (socket) => {
    if (!socket.url().includes('/relay/attach')) return;
    socket.on('framereceived', (frame) => {
      if (typeof frame.payload !== 'string') {
        screen = (screen + frame.payload.toString()).slice(-100_000);
      }
    });
  });
  await page.getByRole('button', { name: /send/i }).click();
  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const sessionId = page.url().split('/').pop() as string;

  // The host holds exactly the bytes the console attached, under the session.
  let saved = '';
  await expect
    .poll(
      () => {
        saved = box.host
          .exec(`find "$HOME" -path "*/images/${sessionId}/*.png" 2>/dev/null`)
          .trim();
        return saved;
      },
      { timeout: 120_000 },
    )
    .toMatch(/\.png$/);
  expect(box.host.exec(`base64 -w0 "${saved}"`).trim()).toBe(png.toString('base64'));

  // And the agent was launched with the task, then that path. The terminal
  // draws on a canvas, so what it shows is read off the attach socket.
  // Escape sequences and the pane's line breaks are stripped, so a path the
  // pane wrapped still reads as one.
  const shown = () => screen.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\s+/g, '');
  await expect.poll(shown, { timeout: 120_000 }).toContain('CLAUDE-SHIMargv=');
  await expect.poll(shown).toContain(`Matchthismockup${saved}`);
  await expect(page.getByText('Live', { exact: true })).toBeVisible();
  await shot('4-session-terminal');
});
