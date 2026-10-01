import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { WEB_URL } from '../../playwright.config';
import { signedUpContext } from '../../support/auth';
import { BootRecorder, CLAUDE_MARKER, SHIM_MARKER } from '../../support/boot-hops';
import { pairedHosts } from '../../support/fleet';
import { connectInstallation, STUB_REPOSITORIES } from '../../support/sessions';
import { signInAs } from '../../support/web';

/**
 * A measurement, not a test of behaviour: how long New session takes from the
 * click on Send to the agent's first bytes on the console's terminal, one hop
 * at a time (`support/boot-hops.ts`). A run that misses a hop fails.
 *
 * Opt-in (`BOOT_BENCH=1`), on the fleet's hosts. Knobs:
 * - `BENCH_RUNS`: sessions in a row on one host; the first is a cold clone;
 * - `BENCH_AGENT=claude`: the host runs the real Claude Code, not the shim;
 * - `BENCH_REMOTE=https://github.com/<owner>/<repo>.git`: the host clones
 *   xrp-mobile from that remote instead of the local git server. Behind a
 *   TLS-inspecting proxy, `GIT_SSL_CAINFO` must name a CA file the host's
 *   account can read, since the runner inherits it;
 * - `BENCH_TABS`: tabs open on the session while it starts;
 * - `BENCH_OUT`: a file to append one JSON line per session to.
 */
test.skip(process.env.BOOT_BENCH !== '1', 'the boot benchmark is opt-in (BOOT_BENCH=1)');
test.describe.configure({ timeout: 900_000 });
test.use({ baseURL: WEB_URL });

const RUNS = Number(process.env.BENCH_RUNS ?? 4);
const AGENT = process.env.BENCH_AGENT === 'claude' ? 'claude' : 'shim';
const TABS = Number(process.env.BENCH_TABS ?? 1);
const REMOTE = process.env.BENCH_REMOTE;
const STUB_URL = `https://github.com/acme-labs/${STUB_REPOSITORIES.mobile.name}.git`;

test('boot: Send → first agent bytes on the console', async ({ page, context }) => {
  if (REMOTE !== undefined) {
    // Interpolated into the host's shell below, so held to a plain GitHub URL.
    expect(REMOTE, 'BENCH_REMOTE').toMatch(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\.git$/);
  }
  const { api, user } = await signedUpContext('bootbench');
  await connectInstallation(api);
  const [box] = await pairedHosts(api, 1, 'bench');
  if (AGENT === 'claude') {
    // Resolved here, not on the host, where the shim is first on the PATH.
    const claude = execFileSync('sh', ['-c', 'command -v claude'], { encoding: 'utf8' }).trim();
    expect(claude, 'claude on this PATH').toMatch(/^[\w./-]+$/);
    box.host.exec(`ln -sf '${claude}' "$HOME/bin/claude"`);
  }
  // The remote's rewrite is more specific than the fleet's own, so it wins for
  // this one repository; it is removed however the run ends.
  const rewrite = `url.${REMOTE}.insteadOf`;
  if (REMOTE) box.host.exec(`git config --global '${rewrite}' '${STUB_URL}'`);

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInAs(page, user);
    for (let run = 1; run <= RUNS; run += 1) {
      await page.goto('/sessions/new');
      await expect(page.getByRole('heading', { name: 'New session', level: 1 })).toBeVisible();
      await page.getByRole('button', { name: 'Host' }).click();
      await page.getByRole('option', { name: new RegExp(box.host.name) }).click();
      await page.getByRole('button', { name: 'Repositories' }).click();
      await page.getByRole('option', { name: new RegExp(STUB_REPOSITORIES.mobile.name) }).click();
      await page.keyboard.press('Escape');
      await page.getByRole('textbox', { name: /Describe a task/ }).fill(`bench run ${run}`);

      const recorder = new BootRecorder(page, AGENT === 'claude' ? CLAUDE_MARKER : SHIM_MARKER);
      recorder.start();
      await page.getByRole('button', { name: /send/i }).click();
      const sessionId = await recorder.navigated();
      const tabs: Page[] = [];
      for (let tab = 1; tab < TABS; tab += 1) {
        const other = await context.newPage();
        await other.goto(`/sessions/${sessionId}`);
        tabs.push(other);
      }
      await recorder.settled();
      for (const other of tabs) await other.close();
      const measured = await recorder.finish();

      const row = { run, agent: AGENT, remote: REMOTE ?? 'local git server', ...measured };
      if (process.env.BENCH_OUT) appendFileSync(process.env.BENCH_OUT, `${JSON.stringify(row)}\n`);
      console.log(JSON.stringify(row));
    }
  } finally {
    if (REMOTE) box.host.exec(`git config --global --unset '${rewrite}' || true`);
  }
});
