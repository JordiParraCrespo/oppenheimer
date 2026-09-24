import { hostname } from 'node:os';
import { type APIRequestContext, expect, test } from '@playwright/test';
import { signedUpContext } from '../../support/auth';
import { attach, FLEET_HOSTS, type FleetHost, pairedHosts, waitForHost } from '../../support/fleet';
import { connectInstallation, createSession, STUB_REPOSITORIES } from '../../support/sessions';

/**
 * Several machines on one account, driven through the real control plane.
 *
 * What the `api` project cannot prove, because its hosts are a keypair and a
 * row: that a real runner pairs through `runner register`, holds the link, runs
 * a session in tmux on *its* machine and streams it back through the relay —
 * and keeps doing so when its network drops or its process dies. Every host
 * here is a container running the real binary (`support/fleet.ts`).
 *
 * The hosts are started by `fleet.setup.ts`'s image, one fresh set per test, so
 * a test that breaks a host breaks only its own.
 */

// Pairing redeems a token at an IP-throttled route, a link that is cut has to
// age past the 30-second online window, and a runner that is killed has to
// come back and say hello: minutes, not seconds.
test.describe.configure({ timeout: 180_000 });

/**
 * Wait for the session's pane to be the shim's shell, then prove it runs on
 * `host` by asking the machine its own name. Local hosts all answer with this
 * machine's name, so there the answer only proves the pane is live.
 */
async function expectRunningOn(api: APIRequestContext, sessionId: string, host: FleetHost) {
  const terminal = await attach(api, sessionId);
  await terminal.waitFor('CLAUDE-SHIM argv=', 60_000);
  terminal.send('echo "on:$(hostname)"\r');
  await terminal.waitFor(`on:${FLEET_HOSTS === 'local' ? hostname() : host.name}`);
  return terminal;
}

test('three machines pair, and each session runs on the machine it names', async () => {
  test.skip(
    FLEET_HOSTS === 'local',
    'local hosts share one hostname: the proof is the container’s',
  );
  const { api } = await signedUpContext('fleetowner');
  const installationId = await connectInstallation(api);
  const hosts = await pairedHosts(api, 3, 'box');

  const sessions = await Promise.all(hosts.map(({ id }) => createSession(api, id, installationId)));
  const terminals = await Promise.all(
    hosts.map(({ host }, i) => expectRunningOn(api, sessions[i], host)),
  );

  // The checkout is a real clone on that machine, and the session works on a
  // branch of its own — whatever the directory layout of the day is.
  const branches = hosts[0].host.exec(
    'find ~/oppenheimer-ai -name README.md -execdir git rev-parse --abbrev-ref HEAD \\;',
  );
  expect(branches.split('\n').filter((branch) => branch !== 'main')).not.toHaveLength(0);

  await Promise.all(terminals.map((terminal) => terminal.close()));
});

test('a machine that loses its network goes offline alone and comes back to the same screen', async () => {
  test.skip(FLEET_HOSTS === 'local', 'a local host cannot lose its network alone');
  const { api } = await signedUpContext('fleetlink');
  const installationId = await connectInstallation(api);
  const [steady, flaky] = await pairedHosts(api, 2, 'link');

  const flakySession = await createSession(api, flaky.id, installationId);
  const before = await expectRunningOn(api, flakySession, flaky.host);
  before.send('echo "marker-$((6*7))"\r');
  await before.waitFor('marker-42');
  await before.close();

  flaky.host.cutLink();
  await waitForHost(api, flaky.host, false);
  // Only the machine that lost its cable: the other is still online.
  await waitForHost(api, steady.host, true, 5_000);

  flaky.host.restoreLink();
  await waitForHost(api, flaky.host, true);

  // tmux kept the pane while the link was down; the tail replay shows it.
  const after = await attach(api, flakySession);
  await after.waitFor('marker-42');
  after.send('echo "back-$((6*7))"\r');
  await after.waitFor('back-42');
  await after.close();
});

test('a runner that dies keeps its sessions, and the next one adopts them', async () => {
  const { api } = await signedUpContext('fleetadopt');
  const installationId = await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'adopt');

  const sessionId = await createSession(api, box.id, installationId);
  const before = await expectRunningOn(api, sessionId, box.host);
  before.send('export SURVIVOR=still-here\r');
  await before.close();

  const tmuxBefore = box.host.exec('tmux -L oppenheimer list-sessions -F "#{session_name}"');
  box.host.killRunner();

  // The supervisor restarts it, as launchd or systemd would; the new process
  // adopts what tmux still holds and says hello as the same host.
  await expect
    .poll(() => box.host.logs().match(/sessions adopted/g)?.length ?? 0, { timeout: 15_000 })
    .toBeGreaterThan(0);
  await waitForHost(api, box.host, true);
  expect(box.host.exec('tmux -L oppenheimer list-sessions -F "#{session_name}"')).toBe(tmuxBefore);

  const after = await attach(api, sessionId);
  after.send('echo "survivor:$SURVIVOR"\r');
  await after.waitFor('survivor:still-here');
  await after.close();
});

test('another account neither sees a machine nor runs a session on it', async () => {
  const owner = await signedUpContext('fleetmine');
  const [box] = await pairedHosts(owner.api, 1, 'mine');

  const stranger = await signedUpContext('fleetstranger');
  const installationId = await connectInstallation(stranger.api);
  const listed = (await (await stranger.api.get('/api/v1/hosts')).json()) as { id: string }[];
  expect(listed.map((row) => row.id)).not.toContain(box.id);

  const refused = await stranger.api.post('/api/v1/sessions', {
    headers: { 'Idempotency-Key': `fleet-stranger-${Date.now()}` },
    data: {
      hostId: box.id,
      agent: 'claude-code',
      checkouts: [{ installationId, githubRepoId: STUB_REPOSITORIES.mobile.githubRepoId }],
    },
    failOnStatusCode: false,
  });
  expect(refused.status()).toBeGreaterThanOrEqual(400);
  expect(refused.status()).toBeLessThan(500);
  // …and nothing started on the machine.
  expect(box.host.exec('tmux -L oppenheimer list-sessions 2>/dev/null || true')).toBe('');
});
