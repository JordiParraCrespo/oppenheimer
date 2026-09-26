import { expect, test } from '@playwright/test';
import {
  connectInstallation,
  redeemPairingToken,
  redemptionStatus,
  tokenFrom,
} from '../../support/sessions';
import { provisionedUser, signInAs } from '../../support/web';

/**
 * Add host, in a browser, against the real control plane.
 *
 * The dialog is how a machine is paired from inside the console
 * (`product/versions/mvp/05-screens.md`), and what it hands the reader is a
 * live credential: the install command it prints carries a token the API
 * minted for this account, and spending it is what makes the machine theirs.
 * So the spec spends it — the secret comes off the screen, a runner redeems it
 * anonymously the way the installer does, and the status line is watched to
 * resolve.
 *
 * The regenerate leg is the one worth the extra minute. It proves the dialog
 * is watching **its** token rather than the host list: after a new token is
 * minted, a runner spending the *old* one gives this account a host, and the
 * status line must stay "Listening for this host…" — otherwise Use this host
 * would arm under a command the reader has already thrown away.
 *
 * The run needs the stack up and the API pointed at the GitHub stub — see
 * `e2e/README.md`. The deployment also needs a runner release configured, or
 * minting answers `HOSTS_004` and there is no command to show.
 */
test('pairs a machine from the console and selects it for the next session', async ({ page }) => {
  // Two registrations at an IP-throttled route; see `redeemPairingToken`.
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

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Add a host' })).toBeVisible();

  // The status line, which is a different element from the panel the command
  // is printed in — asserting on text alone would match the token's own name.
  const status = dialog.locator('[data-slot="status-dot"]');
  await expect(status).toContainText('Listening for this host…');
  await expect(dialog.getByRole('button', { name: 'Use this host' })).toBeDisabled();

  // One instruction, two ways to read it: both carry the same secret, because
  // both are composed by the server around the one token this visit minted.
  const panel = dialog.locator('[data-slot="code-block"] code');
  await expect(panel).toContainText('OPPENHEIMER_REGISTRATION_TOKEN=', { timeout: 30_000 });
  const firstCommand = (await panel.innerText()).trim();

  await dialog.getByRole('button', { name: 'Agent prompt' }).click();
  const agentPrompt = (await panel.innerText()).trim();
  expect(agentPrompt, 'the switch shows the other form of the instruction').not.toBe(firstCommand);
  expect(agentPrompt, 'the agent prompt carries the same token').toContain(tokenFrom(firstCommand));
  await dialog.getByRole('button', { name: 'Command' }).click();

  // ── A new token replaces the one on screen ───────────────────────────────
  await dialog.getByRole('button', { name: 'New token' }).click();
  await expect(panel).not.toHaveText(firstCommand, { timeout: 30_000 });
  const secondCommand = (await panel.innerText()).trim();

  // The thrown-away token no longer pairs anything: asking for a new one revoked
  // it, so a command pasted into the wrong window stops working at once rather
  // than for the rest of its hour. The dialog keeps listening for the new one.
  expect(await redemptionStatus(tokenFrom(firstCommand), 'discarded')).toBe(401);
  await expect(status).toContainText('Listening for this host…');
  await expect(dialog.getByRole('button', { name: 'Use this host' })).toBeDisabled();

  // ── The token on screen, spent ───────────────────────────────────────────
  const hostId = await redeemPairingToken(tokenFrom(secondCommand), 'e2e-box');

  // The status line resolves in place. The name is the token's, not the one
  // the runner detected — naming the machine before it exists is what the mint
  // is for, and the dialog names it "New host".
  await expect(status).toContainText('New host', { timeout: 30_000 });
  const use = dialog.getByRole('button', { name: 'Use this host' });
  await expect(use).toBeEnabled();
  await use.click();

  // Out of the dialog and into the draft: the machine just paired is the one
  // the next session will run on.
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Host' })).toContainText('New host');

  // And the control plane holds it under the id the runner was given.
  const read = await owner.api.get('/api/v1/hosts', { failOnStatusCode: false });
  expect(read.status(), await read.text()).toBe(200);
  const hosts = (await read.json()) as { id: string; name: string }[];
  expect(hosts.map((host) => host.id)).toContain(hostId);

  await owner.api.dispose();
});
