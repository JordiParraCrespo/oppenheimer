import { expect, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { pairedHosts } from '../../support/fleet';
import { connectInstallation, createSession, waitForLifecycle } from '../../support/sessions';
import { signInAs } from '../../support/web';

/**
 * Remove host with a session running, on a real runner: what the dialog says
 * happens is checked on the machine — the agent's tmux session ends, its
 * worktree stays, and the control plane has it stopped. Needs the console on
 * `WEB_URL`.
 */
test.describe.configure({ timeout: 180_000 });
test.use({ baseURL: WEB_URL });

test('removing a host stops its sessions on the machine', async ({ page }) => {
  const up = await fetch(WEB_URL).then(
    (response) => response.ok,
    () => false,
  );
  test.skip(!up, `the console is not running on ${WEB_URL}`);

  const { api, user } = await signedUpContext('fleetremove');
  const installationId = await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'remove');
  const sessionId = await createSession(api, box.id, installationId);
  const { checkouts } = await waitForLifecycle(api, sessionId, 'open');
  const tmuxName = `opp-${sessionId}`;
  const tmux = () =>
    box.host.exec('tmux -L oppenheimer ls -F "#{session_name}" 2>/dev/null || true');
  expect(tmux()).toContain(tmuxName);
  // This session's worktree, the only one on this host: the branch it is on.
  const worktree = () =>
    box.host.exec(
      'for d in ~/oppenheimer-ai/workspaces/*/*/.worktrees/*/; do git -C "$d" branch --show-current; done 2>/dev/null || true',
    );
  // The row opens with the pane, before the clone: the worktree follows.
  await expect.poll(worktree, { timeout: 60_000 }).toBe(checkouts[0]?.branch);

  await signInAs(page, user);
  await page.goto('/settings/hosts');
  await page
    .getByTestId('host-card')
    .getByRole('button', { name: `${box.host.name} actions` })
    .click();
  await page.getByRole('menuitem', { name: 'Remove host' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText(`1 session is running on ${box.host.name}. It is stopped`);
  await dialog.getByRole('button', { name: 'Remove host' }).click();
  await expect(page.getByTestId('host-card')).toHaveCount(0);

  // Stopped, not closed: its tmux session is gone and its worktree is not.
  await expect.poll(tmux, { timeout: 30_000 }).not.toContain(tmuxName);
  expect(worktree()).toBe(checkouts[0]?.branch);
  const { stoppedAt } = await waitForLifecycle(api, sessionId, 'open', 10_000);
  expect(stoppedAt).not.toBeNull();
});
