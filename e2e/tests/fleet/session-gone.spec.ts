import { expect, test } from '@playwright/test';
import { signedUpContext } from '../../support/auth';
import { type FleetHost, pairedHosts } from '../../support/fleet';
import { connectInstallation, createSession, waitForLifecycle } from '../../support/sessions';

/**
 * A session removed on its host — its tmux session killed and its worktree
 * deleted by hand — on a real runner. Neither Restart nor Delete can bring it
 * back or push its work, and neither may leave its row stuck: the host
 * answers both by closing it, and the row resolves.
 */
test.describe.configure({ timeout: 180_000 });

/** Kill the session's tmux session and delete its worktree, as a person on the host might. */
function removeOnHost(host: FleetHost, sessionId: string, branch: string): void {
  host.exec(`tmux -L oppenheimer kill-session -t 'opp-${sessionId}' 2>/dev/null || true`);
  // The worktree is found by the branch it has checked out: its directory is
  // named by the runner, not by anything the API reports.
  const worktree = host
    .exec(
      `for d in $(find "$HOME/oppenheimer" -mindepth 5 -maxdepth 5 -type d -path '*/sessions/*' 2>/dev/null); do ` +
        `[ "$(git -C "$d" rev-parse --abbrev-ref HEAD 2>/dev/null)" = '${branch}' ] && echo "$d"; done; true`,
    )
    .trim();
  expect(worktree, `the worktree on ${branch}`).not.toBe('');
  host.exec(`rm -rf '${worktree}'`);
}

test('restart and delete close a session that is gone from its host', async () => {
  const { api } = await signedUpContext('fleetgone');
  const installationId = await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'gone');

  const restarted = await createSession(api, box.id, installationId);
  const deleted = await createSession(api, box.id, installationId);
  await waitForLifecycle(api, restarted, 'open');
  await waitForLifecycle(api, deleted, 'open');
  const branchOf = async (id: string) =>
    (await waitForLifecycle(api, id, 'open', 10_000)).checkouts[0].branch;

  // Stopped from the console, then its worktree deleted on the host: Restart
  // has nothing to resume in.
  expect((await api.post(`/api/v1/sessions/${restarted}/stop`)).status()).toBeLessThan(300);
  await expect
    .poll(
      async () =>
        (
          (await (await api.get(`/api/v1/sessions/${restarted}`)).json()) as {
            stoppedAt: string | null;
          }
        ).stoppedAt,
      { timeout: 30_000 },
    )
    .not.toBeNull();
  removeOnHost(box.host, restarted, await branchOf(restarted));
  expect((await api.post(`/api/v1/sessions/${restarted}/restart`)).status()).toBeLessThan(300);
  await waitForLifecycle(api, restarted, 'resolved', 30_000);

  // Removed on the host while running: Delete has no worktree to push from,
  // and without accepting the loss of unpushed work it still goes through.
  removeOnHost(box.host, deleted, await branchOf(deleted));
  expect((await api.delete(`/api/v1/sessions/${deleted}`)).status()).toBeLessThan(300);
  await waitForLifecycle(api, deleted, 'resolved', 30_000);
});
