import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Browser, chromium, expect, type Page, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { query } from '../../support/db';
import { uniqueHostName, waitForHost } from '../../support/fleet';
import { startLocalHost } from '../../support/fleet-local';
import {
  browserOn,
  buildNetsim,
  bytesBetween,
  enter,
  netsimAvailable,
  netsimDown,
  netsimUp,
  onPath,
  type Placement,
  place,
  resetLegStats,
} from '../../support/netsim';
import { connectInstallation, createSession, mintPairingToken } from '../../support/sessions';
import { linkLive, signInAs } from '../../support/web';

/**
 * How typing feels from different places to hosts behind different internet
 * connections, on the relay and on the direct path: the browser and every
 * host on a simulated network (`e2e/netsim`), the relay in Falkenstein where
 * the dev deployment runs. The measure is taken in the page: from the
 * keydown to the grid's text changing with the echo.
 *
 * A bench, not a gate: it asserts only that each path was the one measured,
 * and writes the table to `test-results/netsim-typing.md`. The page loads on
 * a fast link and the scenario is applied once the terminal is live, because
 * a dev server's hundreds of modules over a 4G link from Tokyo measure Vite,
 * not typing.
 *
 * NETSIM_HOSTS, NETSIM_BROWSERS (comma-separated names below) and NETSIM_KEYS
 * narrow or lengthen a run.
 */
test.describe.configure({ timeout: 90 * 60_000 });

const RELAY: Placement = { location: 'falkenstein', access: 'datacenter' };
/** Where the page loads: next to the relay, so loading costs nothing. */
const LOADING: Placement = RELAY;
const HOME = 'barcelona';

interface BrowserScenario {
  name: string;
  label: string;
  placement: Placement;
  /** On the host's own LAN: the host joins it for the measurement. */
  sameLan?: boolean;
}

const BROWSERS: BrowserScenario[] = [
  {
    name: 'same-lan',
    label: 'At home, same Wi-Fi as the host',
    placement: { location: HOME, access: 'fiber', lan: 'home' },
    sameLan: true,
  },
  {
    name: 'same-city',
    label: 'Same city, another fibre line',
    placement: { location: HOME, access: 'fiber' },
  },
  {
    name: 'new-york',
    label: 'New York, hotel Wi-Fi',
    placement: { location: 'new-york', access: 'hotel-wifi' },
  },
  { name: 'tokyo', label: 'Tokyo, 4G', placement: { location: 'tokyo', access: '4g' } },
];
const HOST_ACCESS = ['fiber', 'cable', 'adsl', '4g', 'starlink'];

function pick<T>(all: T[], env: string | undefined, nameOf: (t: T) => string): T[] {
  if (!env) return all;
  const wanted = env.split(',').map((s) => s.trim());
  return all.filter((t) => wanted.includes(nameOf(t)));
}

const browsers = pick(BROWSERS, process.env.NETSIM_BROWSERS, (b) => b.name);
const hostAccess = pick(HOST_ACCESS, process.env.NETSIM_HOSTS, (a) => a);
const KEYS = Number(process.env.NETSIM_KEYS ?? 20);

interface Reading {
  p50: number;
  p95: number;
  n: number;
}

/**
 * One key's round trip, in the page: from its keydown to the grid's text
 * changing with the echo. Null when no echo came within ten seconds.
 */
async function echoMs(page: Page, key: string): Promise<number | null> {
  await page.evaluate(() => {
    const rows = document.querySelector('.xterm-rows');
    const before = rows?.textContent;
    (window as unknown as { echo: Promise<number | null> }).echo = new Promise((resolve) => {
      if (!rows) return resolve(null);
      let start = 0;
      document.addEventListener(
        'keydown',
        () => {
          start = performance.now();
        },
        { capture: true, once: true },
      );
      const observer = new MutationObserver(() => {
        if (!start || rows.textContent === before) return;
        observer.disconnect();
        resolve(performance.now() - start);
      });
      observer.observe(rows, { subtree: true, childList: true, characterData: true });
      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, 10_000);
    });
  });
  await page.keyboard.press(key);
  return page.evaluate(() => (window as unknown as { echo: Promise<number | null> }).echo);
}

function quantile(sorted: number[], q: number): number {
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]);
}

/** Types `KEYS` keys, each once the last one's echo is in. */
async function typeAndRead(page: Page): Promise<Reading> {
  await page.locator('.xterm').first().click();
  const samples: number[] = [];
  for (let i = 0; i < KEYS; i += 1) {
    const ms = await echoMs(page, String.fromCharCode(97 + (i % 26)));
    if (ms !== null) samples.push(ms);
    await page.waitForTimeout(250);
  }
  await page.keyboard.press('Control+U');
  if (samples.length === 0) throw new Error('no key was echoed');
  samples.sort((a, b) => a - b);
  return { p50: quantile(samples, 0.5), p95: quantile(samples, 0.95), n: samples.length };
}

type FlagRow = { enabled: boolean; rules: unknown; fallthrough: unknown };

/** Turns the direct path on for everyone, and returns what puts it back. */
async function enableDirectPath(api: Awaited<ReturnType<typeof signedUpContext>>['api']) {
  const [before] = await query<FlagRow>(
    `SELECT enabled, rules, fallthrough FROM feature_flag WHERE key = 'terminal_direct_path'`,
  );
  await query(
    `INSERT INTO feature_flag (id, key, enabled, rules, fallthrough, salt)
     VALUES (gen_random_uuid(), 'terminal_direct_path', true, '[]', '{"value": true}', 'netsim')
     ON CONFLICT (key) DO UPDATE SET enabled = true, rules = '[]', fallthrough = '{"value": true}'`,
  );
  // Every replica picks a change up on its next snapshot poll.
  await expect
    .poll(
      async () => {
        const response = await api.get('/api/v1/feature-flags');
        return (await response.text()).includes('"terminal_direct_path":true');
      },
      { timeout: 60_000, intervals: [1_000] },
    )
    .toBe(true);
  return async () => {
    if (!before) {
      await query(`DELETE FROM feature_flag WHERE key = 'terminal_direct_path'`);
      return;
    }
    await query(
      `UPDATE feature_flag SET enabled = $1, rules = $2, fallthrough = $3 WHERE key = 'terminal_direct_path'`,
      [before.enabled, JSON.stringify(before.rules), JSON.stringify(before.fallthrough)],
    );
  };
}

test('typing latency: relay vs direct, by place and host connection', async () => {
  test.skip(!process.env.E2E_NETSIM, 'set E2E_NETSIM=1 to run the network bench');
  test.skip(!netsimAvailable(), 'netsim needs Linux, root and /dev/net/tun');
  test.skip(process.env.FLEET_HOSTS !== 'local', 'netsim runs local hosts (FLEET_HOSTS=local)');

  const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
  buildNetsim(repoRoot);
  const hostNodes = hostAccess.map((access) => ({
    name: `host-${access}`,
    access,
    placement: { location: HOME, access } as Placement,
  }));
  await netsimUp(
    RELAY,
    [3000, 3001, 9418],
    [
      { name: 'browser', placement: LOADING, ports: [3000, 3001] },
      ...hostNodes.map((h) => ({ name: h.name, placement: h.placement, ports: [3001, 9418] })),
    ],
  );

  let browser: Browser | undefined;
  let restoreFlag: (() => Promise<void>) | undefined;
  try {
    const { api, user } = await signedUpContext('netsim');
    const installationId = await connectInstallation(api);
    const hosts = [];
    for (const node of hostNodes) {
      const name = uniqueHostName(node.name);
      const host = startLocalHost(name, await mintPairingToken(api, name), {
        enter: enter(node.name),
      });
      const row = await waitForHost(api, host, true, 120_000);
      hosts.push({ ...node, sessionId: await createSession(api, row.id, installationId) });
    }
    restoreFlag = await enableDirectPath(api);

    const chrome = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? chromium.executablePath();
    browser = await chromium.launch({ executablePath: browserOn('browser', chrome) });

    const rows: string[] = [];
    for (const scenario of browsers) {
      for (const host of hosts) {
        const result: Record<string, Reading & { relayBytes: number; directBytes: number }> = {};
        for (const path of ['relay', 'direct'] as const) {
          await place('browser', LOADING);
          await place(host.name, host.placement);
          const context = await browser.newContext({
            baseURL: WEB_URL,
            viewport: { width: 1280, height: 760 },
          });
          const page = await context.newPage();
          if (path === 'relay') {
            await page.addInitScript(() => {
              // No WebRTC in this tab: the console stays on the relay.
              Object.defineProperty(window, 'RTCPeerConnection', { value: undefined });
            });
          }
          await signInAs(page, user);
          await page.goto(`/sessions/${host.sessionId}`);
          await expect(linkLive(page)).toBeVisible({ timeout: 120_000 });
          await onPath(path, host.name);

          await place('browser', scenario.placement);
          if (scenario.sameLan) await place(host.name, { ...host.placement, lan: 'home' });
          await page.waitForTimeout(1_500);
          await resetLegStats();
          const read = await typeAndRead(page);
          result[path] = {
            ...read,
            relayBytes: await bytesBetween('browser', 'relay'),
            directBytes: await bytesBetween('browser', host.name),
          };
          // The direct run's keys went browser to host; the relay run has no WebRTC.
          if (path === 'direct') {
            expect(
              result.direct.directBytes,
              `${scenario.name} → ${host.name} left the direct path`,
            ).toBeGreaterThan(0);
          }
          await page.screenshot({
            path: join('test-results', `netsim-${scenario.name}-${host.name}-${path}.png`),
          });
          await context.close();
        }
        const { relay, direct } = result;
        const row = `| ${scenario.label} | ${host.access} | ${relay.p50} / ${relay.p95} | ${direct.p50} / ${direct.p95} | ${relay.p50 - direct.p50} | ${direct.relayBytes} / ${direct.directBytes} |`;
        console.log(row);
        rows.push(row);
      }
    }

    const report = [
      '# Typing latency, relay vs direct (netsim)',
      '',
      `Relay in Falkenstein (data centre); hosts in Barcelona. ${KEYS} keys per cell; echo p50 / p95 in ms, keydown to echo drawn, timed in the page.`,
      '',
      '| Browser | Host connection | Relay p50 / p95 | Direct p50 / p95 | Saved at p50 | Direct run: bytes via relay / direct |',
      '| --- | --- | --- | --- | --- | --- |',
      ...rows,
      '',
    ].join('\n');
    writeFileSync(join('test-results', 'netsim-typing.md'), report);
  } finally {
    await restoreFlag?.();
    await browser?.close();
    netsimDown();
  }
});
