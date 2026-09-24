import { expect, test } from '@playwright/test';
import { signedUpContext } from '../../support/auth';
import { attach, pairedHosts, type Terminal } from '../../support/fleet';
import { connectInstallation, createSession } from '../../support/sessions';

/**
 * One link per host, however many sessions it runs (01, "Parties and
 * sockets"): ten sessions attached at once ride the runner's one connection,
 * which it opened once and never had to open again.
 *
 * Counted where the runner says so — its log names every link it brings up —
 * so the check needs nothing from the machine running the suite.
 */
test.describe.configure({ timeout: 300_000 });

test('ten sessions on one host ride one link', async () => {
  const { api } = await signedUpContext('fleetlink1');
  const installationId = await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'onelink');

  const panes: Terminal[] = [];
  for (let i = 0; i < 10; i += 1) {
    const pane = await attach(api, await createSession(api, box.id, installationId));
    await pane.waitFor('CLAUDE-SHIM argv=', 120_000);
    panes.push(pane);
  }
  // Every pane answers, so every attachment is live on the link right now.
  for (const [i, pane] of panes.entries()) {
    pane.send(`echo pane-$((${i}+100))\r`);
    await pane.waitFor(`pane-${i + 100}`);
  }

  const linksUp = box.host.logs().match(/control-plane link up/g) ?? [];
  expect(linksUp, box.host.logs().slice(-2_000)).toHaveLength(1);
  await Promise.all(panes.map((pane) => pane.close()));
});
