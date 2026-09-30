import { defineConfig, devices } from '@playwright/test';

/**
 * `api` drives the REST routes with `request` only; `web` drives `apps/web` in
 * Chromium; the opt-in `fleet` projects pair real runners (below).
 *
 * All assume the API on `API_URL`, the web app on `WEB_URL` and the Postgres
 * the root `.env`'s `DB_*` variables name (`support/db.ts`): tests read
 * reset and verification tokens from the database and the API log rather than
 * a mailbox.
 */
export const API_URL = process.env.API_URL ?? 'http://localhost:3001';
export const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH;
/**
 * The browser every project that opens a page uses. An environment that
 * already ships a Chromium — a container image, a sandbox — says where it is
 * rather than downloading a second copy for the build this Playwright happens
 * to pin. Unset, Playwright resolves its own, which is what CI does.
 */
const chromium = {
  ...devices['Desktop Chrome'],
  launchOptions: CHROMIUM_PATH ? { executablePath: CHROMIUM_PATH } : undefined,
};
// oppenheimer:begin runner
/**
 * Real runners in containers, paired with the API under test. Opt-in with
 * `E2E_FLEET=1` (what `e2e:fleet` sets): it needs Docker and Go on the machine
 * running the suite, so a plain `playwright test` never selects it. With
 * `FLEET_HOSTS=local` the hosts run on this machine instead and Docker is not
 * needed. See `support/fleet.ts`.
 */
const FLEET = Boolean(process.env.E2E_FLEET);

function fleetProjects() {
  return [
    {
      name: 'fleet-setup',
      testDir: './tests/fleet',
      testMatch: /fleet\.setup\.ts/,
      teardown: 'fleet-teardown',
    },
    { name: 'fleet-teardown', testDir: './tests/fleet', testMatch: /fleet\.teardown\.ts/ },
    {
      name: 'fleet',
      testDir: './tests/fleet',
      testMatch: /\.spec\.ts/,
      dependencies: ['fleet-setup'],
      // A spec here may open the console on a live host (`console.spec.ts`).
      use: { ...chromium, baseURL: API_URL },
    },
  ];
}
// oppenheimer:end runner

export default defineConfig({
  testDir: './tests',
  // Auth flows mutate shared rows (sessions, verification tokens) for the user
  // under test; every test mints its own user, so files can run in parallel.
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  // Every artifact lands under a directory Biome and git already ignore, so a
  // local run never leaves generated output for `pnpm check` to lint.
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // The rate-limit test deliberately trips the per-IP throttle, which would
  // then refuse every other test sharing that IP. Run it on its own with
  // `pnpm --filter @oppenheimer/e2e e2e:ratelimit`.
  grepInvert: process.env.RUN_RATE_LIMIT ? undefined : /@ratelimit/,
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'api',
      testDir: './tests/api',
      use: { baseURL: API_URL },
    },
    // oppenheimer:begin runner
    ...(FLEET ? fleetProjects() : []),
    // oppenheimer:end runner
    // oppenheimer:begin web
    {
      name: 'web',
      testDir: './tests/web',
      use: {
        ...chromium,
        baseURL: WEB_URL,
        // The web app talks to the API through Vite's `/api` proxy, so the
        // session cookie stays same-origin exactly as it does in production.
        ignoreHTTPSErrors: true,
      },
    },
    // oppenheimer:end web
  ],
});
