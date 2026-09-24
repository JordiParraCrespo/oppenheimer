import { expect, test } from '@playwright/test';
import { signedUpContext } from '../../support/auth';
import { attach, pairedHosts, type Terminal } from '../../support/fleet';
import { connectInstallation, createSession } from '../../support/sessions';

/**
 * Flow control on the link (01, "Flow control and reconnect"): panes printing
 * tens of megabytes finish and still answer — credit keeps flowing back, so
 * no pane stalls for good — and typing in a quiet pane on the same host is not
 * queued behind them, because the runner's writer takes attachments in turn.
 *
 * The terminals credit what they read, as the console does; without it every
 * pane here would stop at the credit window, by design.
 */
test.describe.configure({ timeout: 600_000 });

/** Generous on purpose: the claim is "not behind the flood", not a benchmark. */
const ECHO_P90_BUDGET_MS = 1_000;

async function echoP90(pane: Terminal, label: string): Promise<number> {
  const samples: number[] = [];
  for (let i = 0; i < 20; i += 1) {
    const marker = `k${label}${i}x${Math.random().toString(36).slice(2, 7)}`;
    const started = performance.now();
    pane.send(marker);
    await pane.waitFor(marker);
    samples.push(performance.now() - started);
    pane.send('\u0015'); // ^U clears the line the marker was typed on
  }
  samples.sort((a, b) => a - b);
  const p90 = samples[Math.floor(0.9 * samples.length)];
  test.info().annotations.push({ type: `echo p90 ${label}`, description: `${p90.toFixed(1)} ms` });
  return p90;
}

test('floods on three panes stall neither themselves nor typing on a fourth', async () => {
  const { api } = await signedUpContext('fleetflow');
  const installationId = await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'flow');

  const panes: Terminal[] = [];
  for (let i = 0; i < 4; i += 1) {
    const pane = await attach(api, await createSession(api, box.id, installationId), {
      credit: true,
      keep: 200_000,
    });
    await pane.waitFor('CLAUDE-SHIM argv=', 120_000);
    panes.push(pane);
  }
  const [typist, ...floods] = panes.reverse();

  for (const pane of floods) {
    // Tens of megabytes of base64; the quoted "" keeps the echoed command line
    // from matching the marker.
    pane.send(
      'for i in $(seq 1 400); do head -c 200000 /dev/urandom | base64 -w 200; done; echo FLOOD-""DONE\r',
    );
  }
  expect(await echoP90(typist, 'under-flood')).toBeLessThan(ECHO_P90_BUDGET_MS);

  for (const pane of floods) {
    await pane.waitFor('FLOOD-DONE', 300_000);
    pane.send('echo alive-$((6*7))\r');
    await pane.waitFor('alive-42');
    expect(pane.bytes()).toBeGreaterThan(10_000_000);
  }
  expect(panes.map((pane) => pane.closeCode())).toEqual(panes.map(() => null));
  await Promise.all(panes.map((pane) => pane.close()));
});
