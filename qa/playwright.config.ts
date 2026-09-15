import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * The QA pack's browser runner.
 *
 * Separate from `apps/web`'s end-to-end config on purpose. That suite guards
 * the web app against regressions and is tuned to be quiet; this one is a QA
 * pass whose output is evidence, so it screenshots deliberately at every step
 * rather than only when something breaks, and it reports per scenario rather
 * than per assertion.
 *
 * It runs against the stack `qa env up` brings up. Nothing is mocked except
 * the four failure modes DASH-04 has to induce, which are routed in the
 * browser because there is no other way to ask a healthy API for a 500.
 */
const WEB_URL = process.env.QA_WEB_URL ?? 'http://localhost:3000';

/**
 * Sandboxes and CI images often ship a Chromium of their own instead of the
 * revision `playwright install` would fetch, and Playwright refuses to launch
 * a revision it did not download — so the browser is right there on disk and
 * the run still fails with "Executable doesn't exist".
 *
 * Resolved in order: an explicit override, then the conventional location such
 * an image uses, then nothing at all, which lets Playwright find its own
 * browser exactly as it normally would on a developer's machine.
 */
const PREINSTALLED_CHROMIUM = '/opt/pw-browsers/chromium';

function resolveChromium(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  return existsSync(PREINSTALLED_CHROMIUM) ? PREINSTALLED_CHROMIUM : undefined;
}

const executablePath = resolveChromium();

export default defineConfig({
  testDir: './specs',
  // Traces and per-test attachments go where every other run output goes.
  // Playwright's default puts `test-results/` beside the config, which is a
  // second generated directory to remember to ignore, and the one that gets
  // committed by accident.
  outputDir: './artifacts/test-results',
  // Scenarios share one database and sign in as fixed accounts, so parallel
  // files would be reading each other's writes.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  // No retries. A QA pass is asking what the product does, and a scenario that
  // passes on the second attempt has already answered.
  retries: 0,
  // Generous: a scenario applies its own fixture (the volume one writes forty
  // thousand rows), signs in through the real form, and waits on real network.
  timeout: 180_000,
  reporter: [['list'], ['./src/results-reporter.ts']],
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    video: 'off',
    screenshot: 'off',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // A laptop, because that is what the product is used on and the
        // evidence should show what a person actually sees in one glance.
        // 1440×900 is 16:10 — the most common laptop logical resolution — and
        // it is set *after* the spread so it wins.
        //
        // This used to be 1440×1400: the app shell is `h-svh` and scrolls an
        // inner element, so `fullPage` never exceeds the window, and the
        // window was stretched until the whole page fitted inside it. That
        // bought completeness at the cost of showing a screen no one has. The
        // harness now takes the honest viewport shot and *says in the report*
        // when there was more below the fold, which keeps the evidence honest
        // without inventing a display to fit it on.
        viewport: { width: 1440, height: 900 },
        // A real laptop is a retina panel, and screenshots read as blurry
        // without this. Doubles the PNG's pixel dimensions, not its layout.
        deviceScaleFactor: 2,
      },
    },
  ],
});
