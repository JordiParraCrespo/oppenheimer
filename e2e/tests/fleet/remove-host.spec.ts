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
  await waitForLifecycle(api, sessionId, 'open');
  const tmux = () =>
    box.host.exec('tmux -L oppenheimer ls -F "#{session_name}" 2>/dev/null || true');
  expect(tmux()).toContain('opp-');

  await signInAs(page, user);
  await page.goto('/settings/hosts');
  await page
    .getByTestId('host-card')
    .getByRole('button', { name: `${box.host.name} actions` })
    .click();
  await page.getByRole('menuitem', { name: 'Remove host' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(`1 session is running on ${box.host.name}. It is stopped`);
  await dialog.getByRole('button', { name: 'Remove host' }).click();
  await expect(page.getByTestId('host-card')).toHaveCount(0);

  await expect.poll(tmux, { timeout: 30_000 }).not.toContain('opp-');
  expect(box.host.exec('ls -d ~/oppenheimer-ai/workspaces/*/*/worktrees/*')).not.toBe('');
  const session = await (await api.get(`/api/v1/sessions/${sessionId}`)).json();
  expect(session.stoppedAt).not.toBeNull();
});
