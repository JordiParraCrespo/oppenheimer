import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import {
  type CreditingTerminal,
  createSession,
  localHost,
  openTerminal,
  ownerContext,
} from '../../support/local-host';

/**
 * One host, many sessions, one link (`product/versions/mvp/01-protocol.md`):
 * what the unit tests on either side of the link cannot show together.
 *
 * - every session on a host shares the runner's one connection to the API;
 * - a pane printing tens of megabytes stalls neither itself (credit flows back)
 *   nor another pane's typing (the runner's writer takes attachments in turn);
 * - the link survives all of it.
 *
 * Against the stack's real runner (`scripts/stack/stack.mjs host`).
 */
test.describe.configure({ timeout: 600_000 });

const SESSIONS = 10;
const FLOODS = 3;
/** Generous: the point is "does not wait behind the flood", not a benchmark. */
const ECHO_P90_UNDER_FLOOD_MS = 1_000;

async function echoLatency(pane: CreditingTerminal, label: string, rounds = 20) {
  const samples: number[] = [];
  for (let i = 0; i < rounds; i += 1) {
    const marker = `k${label}${i}x${Math.random().toString(36).slice(2, 7)}`;
    const started = performance.now();
    pane.send(marker);
    await pane.waitFor(marker);
    samples.push(performance.now() - started);
    pane.send('\u0015'); // ^U clears the line the marker was typed on
  }
  samples.sort((a, b) => a - b);
  const at = (q: number) => samples[Math.min(samples.length - 1, Math.floor(q * samples.length))];
  console.log(
    `${label}: echo p50 ${at(0.5).toFixed(1)} ms, p90 ${at(0.9).toFixed(1)} ms, max ${at(1).toFixed(1)} ms`,
  );
  return { p50: at(0.5), p90: at(0.9) };
}

test('ten sessions share one link, and a flood stalls neither itself nor its neighbours', async () => {
  const host = localHost();
  const api = await ownerContext(host);

  const panes: CreditingTerminal[] = [];
  for (let i = 0; i < SESSIONS; i += 1) {
    const pane = await openTerminal(api, await createSession(api, host));
    await pane.waitFor('CLAUDE-SHIM argv=', 120_000);
    panes.push(pane);
  }

  // Counted where the sockets are, when the tools to look are there.
  try {
    const pid = execFileSync('pgrep', ['-u', host.account, '-x', 'runner']).toString().trim();
    const open = execFileSync('lsof', [
      '-a',
      '-p',
      pid.split('\n').join(','),
      '-iTCP',
      '-sTCP:ESTABLISHED',
      '-n',
      '-P',
    ])
      .toString()
      .split('\n')
      .filter((line) => line.includes(':3001'));
    console.log(`${SESSIONS} sessions, ${open.length} connection(s) from the runner to the API`);
    expect(open).toHaveLength(1);
  } catch (error) {
    if ((error as { code?: string }).code !== 'ENOENT') throw error;
    console.log('lsof or pgrep missing: connection count not checked');
  }

  const typist = panes[FLOODS];
  await echoLatency(typist, 'idle');

  const floods = panes.slice(0, FLOODS);
  for (const pane of floods) {
    // ~40 MB of base64 per pane; the quoted "" keeps the echoed command from
    // matching the marker.
    pane.send(
      'for i in $(seq 1 400); do head -c 200000 /dev/urandom | base64 -w 200; done; echo FLOOD-""DONE\r',
    );
  }
  const underFlood = await echoLatency(typist, 'under flood');
  expect(underFlood.p90).toBeLessThan(ECHO_P90_UNDER_FLOOD_MS);

  for (const pane of floods) {
    await pane.waitFor('FLOOD-DONE', 300_000);
    pane.send('echo alive-$((6*7))\r');
    await pane.waitFor('alive-42');
  }
  console.log(`flood relayed ${(floods[0].bytes() / 1e6).toFixed(1)} MB through one pane`);
  await echoLatency(typist, 'after flood');
  expect(panes.map((pane) => pane.closeCode())).toEqual(panes.map(() => null));
  for (const pane of panes) pane.close();
});
