import { expect, test } from '@playwright/test';
import {
  connectInstallation,
  redeemPairingToken,
  redemptionStatus,
  tokenFrom,
} from '../../support/sessions';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Add host, in a browser, against the real control plane
 * (`product/versions/mvp/05-screens.md`). The install command the dialog prints
 * carries a live token, so the spec takes it off the screen, redeems it
 * anonymously the way the installer does, and watches the status line resolve.
 *
 * The regenerate leg proves the dialog watches **its** token rather than the
 * host list: a runner spending the *old* one after a regenerate must leave the
 * status line on "Waiting for the host to connect…", or Use this host would
 * arm under a command the reader has already thrown away.
 *
 * Needs the stack up with the API on the GitHub stub (`e2e/README.md`) and a
 * runner release configured, or minting answers `HOSTS_004`.
 */
test('pairs a machine from the console and selects it for the next session', async ({ page }) => {
  // Two registrations at an IP-throttled route; see `THROTTLE_WINDOW_MS` in support/sessions.ts.
  test.slow();
  const owner = await provisionedUser('addhost');
  // Without one the repository chip is empty, which is a different spec's
  // subject; the host chip this one ends on needs the composer either way.
  await connectInstallation(owner.api);

  await signInAs(page, owner.user);
  await page.goto('/sessions/new');

  // The way in is the chip's foot action, where a reader who needs a machine
  // is already looking.
  await page.getByRole('button', { name: 'Host' }).click();
  await page.getByRole('button', { name: 'Add host…' }).click();

  // A dialog over the console since the 2026-09-27 export.
  const pane = page.getByRole('dialog', { name: 'Add a host' });
  await expect(pane).toBeVisible();

  // The status line, which is a different element from the panel the command
  // is printed in — asserting on text alone would match the token's own name.
  const status = pane.locator('[data-slot="host-pairing-status"]');
  await expect(status).toContainText('Waiting for the host to connect…');
  await expect(pane.getByRole('button', { name: 'Use this host' })).toBeDisabled();

  // The way in is copying the instruction; reading it is behind the fold.
  await pane.getByRole('button', { name: 'Inspect command and prompt' }).click();
  // One instruction, two ways to read it: both carry the same secret, because
  // both are composed by the server around the one token this visit minted.
  const panel = pane.locator('[data-slot="code-block"] code');
  await expect(panel).toContainText('OPPENHEIMER_REGISTRATION_TOKEN=', { timeout: 30_000 });
  const firstCommand = (await panel.innerText()).trim();

  await pane.getByRole('tab', { name: 'Agent prompt' }).click();
  const agentPrompt = (await panel.innerText()).trim();
  expect(agentPrompt, 'the switch shows the other form of the instruction').not.toBe(firstCommand);
  expect(agentPrompt, 'the agent prompt carries the same token').toContain(tokenFrom(firstCommand));
  await pane.getByRole('tab', { name: 'Command' }).click();

  // ── A new token replaces the one on screen ───────────────────────────────
  await pane.getByRole('button', { name: 'New token' }).click();
  await expect(panel).not.toHaveText(firstCommand, { timeout: 30_000 });
  const secondCommand = (await panel.innerText()).trim();

  // The thrown-away token no longer pairs anything: asking for a new one revoked
  // it, so a command pasted into the wrong window stops working at once rather
  // than for the rest of its hour. The pane keeps listening for the new one.
  expect(await redemptionStatus(tokenFrom(firstCommand), 'discarded')).toBe(401);
  await expect(status).toContainText('Waiting for the host to connect…');
  await expect(pane.getByRole('button', { name: 'Use this host' })).toBeDisabled();

  // ── The token on screen, spent ───────────────────────────────────────────
  const hostId = await redeemPairingToken(tokenFrom(secondCommand), 'e2e-box');

  // The status line resolves in place. The name is the token's, not the one
  // the runner detected — naming the machine before it exists is what the mint
  // is for, and the dialog names it "New host".
  await expect(status).toContainText('New host', { timeout: 30_000 });
  const use = pane.getByRole('button', { name: 'Use this host' });
  await expect(use).toBeEnabled();
  await use.click();

  // The dialog closes with the machine in the draft: the machine just paired
  // is the one the next session will run on.
  await expect(pane).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Host' })).toContainText('New host');

  const read = await owner.api.get('/api/v1/hosts', { failOnStatusCode: false });
  expect(read.status(), await read.text()).toBe(200);
  const hosts = (await read.json()) as { id: string; name: string }[];
  expect(hosts.map((host) => host.id)).toContain(hostId);

  await owner.api.dispose();
});
