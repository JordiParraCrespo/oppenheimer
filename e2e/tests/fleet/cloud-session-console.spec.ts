import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { pairedHosts } from '../../support/fleet';
import { connectInstallation, STUB_REPOSITORIES, waitForLifecycle } from '../../support/sessions';
import { signInAs } from '../../support/web';

/**
 * A session in Claude Code's cloud, from the console to a real runner
 * (`product/research/cloud-agents.md` §5B): New session's Where chip offers
 * Claude Code cloud on a host, the session opens on a pane with no terminal —
 * its state, a link to claude.ai/code and the teleport command — and the state
 * follows what the browser extension reports. Needs the console on `WEB_URL`.
 */
test.describe.configure({ timeout: 240_000 });
test.use({ baseURL: WEB_URL });

test('New session starts a session in Claude Code cloud, and the console follows it', async ({
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

  const { api, user } = await signedUpContext('fleetcloudui');
  await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'cloud-ui');

  await page.setViewportSize({ width: 1280, height: 800 });
  await signInAs(page, user);
  await page.goto('/sessions/new');

  await page.getByRole('button', { name: 'Host', exact: true }).click();
  await page.getByRole('option', { name: new RegExp(box.host.name) }).click();
  await shot('cloud-1-where');
  await page.getByRole('option', { name: /Claude Code cloud/ }).click();
  await expect(page.getByRole('button', { name: 'Host', exact: true })).toContainText(
    `${box.host.name} · Claude Code cloud`,
  );
  await page.getByRole('button', { name: 'Repositories' }).click();
  await page.getByRole('option', { name: new RegExp(STUB_REPOSITORIES.mobile.name) }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('textbox').last().fill('Fix the wallet list empty state');
  await shot('cloud-2-composer');
  await page.getByRole('button', { name: /send/i }).click();

  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const sessionId = page.url().split('/').pop() as string;
  const opened = await waitForLifecycle(api, sessionId, 'open');
  const detail = (await (await api.get(`/api/v1/sessions/${sessionId}`)).json()) as {
    place: string;
    cloudSessionId: string;
    organizationId: string;
  };
  expect(detail.place).toBe('cloud');

  // No terminal: the session's state, its page on claude.ai, and the way into a terminal.
  const open = page.getByRole('link', { name: 'Open in claude.ai' });
  await expect(open).toHaveAttribute('href', `https://claude.ai/code/${detail.cloudSessionId}`);
  await expect(page.getByText(`claude --teleport ${detail.cloudSessionId}`)).toBeVisible();
  await expect(
    page
      .getByRole('listitem')
      .filter({ has: page.getByRole('link', { name: opened.name, exact: true }) })
      .locator('svg.lucide-cloud'),
  ).toHaveCount(1);

  // Until the extension says anything, the session is idle.
  await expect(page.getByText('Idle', { exact: true }).first()).toBeVisible();

  // The extension reports it working; the console follows without a reload.
  const minted = await api.post('/api/v1/tokens', {
    data: {
      name: 'Chrome extension',
      scopes: ['sessions:write'],
      organizationIds: [detail.organizationId],
    },
  });
  const { token } = (await minted.json()) as { token: string };
  const reported = await api.post('/api/v1/sessions/cloud-status', {
    headers: { Authorization: `Bearer ${token}` },
    data: { sessions: [{ cloudSessionId: detail.cloudSessionId, state: 'running' }] },
  });
  expect(await reported.json()).toEqual({ matched: 1 });
  await expect(page.getByText('Idle', { exact: true }).first()).toBeHidden({ timeout: 30_000 });
  await expect(page.getByText('Running', { exact: true }).first()).toBeVisible();
  await shot('cloud-3-session');
});
