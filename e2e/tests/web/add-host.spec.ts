import { expect, test } from '@playwright/test';
import { connectInstallation, redeemPairingToken, tokenFrom } from '../../support/sessions';
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
 * That is the assertion worth making here, and the reason correlating by
 * *token* rather than by "the host list grew" matters: an account that already
 * owns a machine would satisfy the second answer the moment the dialog opened,
 * enabling Use this host under a command nobody had run.
 *
 * The run needs the stack up and the API pointed at the GitHub stub — see
 * `e2e/README.md`. The deployment also needs a runner release configured, or
 * minting answers `HOSTS_004` and there is no command to show.
 */
test('pairs a machine from the console and selects it for the next session', async ({ page }) => {
  // Registration is IP-throttled, and the dialog polls; see `redeemPairingToken`.
  test.slow();
  const owner = await provisionedUser('addhost');
  // Without one the composer never renders, and the chip this ends on is part
  // of what the dialog is for.
  await connectInstallation(owner.api);

  await signInAs(page, owner.user);
  await page.goto('/sessions/new');

  // An account with no machine is told so by the screen, and the way out of
  // that state is the dialog rather than a trip back through onboarding.
  await expect(page.getByText(/no host yet/i)).toBeVisible();
  await page.getByRole('button', { name: 'Add a host' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Add a host' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Use this host' })).toBeDisabled();

  // One instruction, two ways to read it: both carry the same secret, because
  // both are composed by the server around the one token this visit minted.
  const panel = dialog.locator('[data-slot="code-block"] code');
  await expect(panel).toContainText('--token', { timeout: 30_000 });
  const installCommand = (await panel.innerText()).trim();

  await dialog.getByRole('button', { name: 'Agent prompt' }).click();
  const agentPrompt = (await panel.innerText()).trim();
  expect(agentPrompt, 'the switch shows the other form of the instruction').not.toBe(
    installCommand,
  );

  const secret = tokenFrom(installCommand);
  expect(agentPrompt, 'the agent prompt carries the same token').toContain(secret);

  // The machine, spending the token the reader is looking at.
  const hostId = await redeemPairingToken(secret, 'e2e-box');

  // The status line resolves in place: the token names a host, so the dialog
  // looks that host up and offers it. The name is the token's, not the one the
  // runner detected — naming the machine before it exists is what the mint is
  // for, and the dialog names it "New host".
  await expect(dialog.getByText('New host')).toBeVisible({ timeout: 30_000 });
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
});
