import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end coverage for the authentication surface.
 *
 * Two projects share one runner:
 *   - `api` drives the Better Auth endpoints and the REST routes behind them
 *     with `request` only, so it needs no browser.
 *   - `web` drives `apps/web` in Chromium, exercising the same flows through
 *     the UI a user actually sees.
 *
 * Both assume the API on `API_URL` and the web app on `WEB_URL`, with the
 * Postgres from `docker compose up` reachable at `DATABASE_URL` — the tests
 * read reset/verification tokens straight out of the database and the API log
 * rather than needing a mailbox.
 */
export const API_URL = process.env.API_URL ?? 'http://localhost:3001';
export const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';

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
  // `pnpm test:ratelimit`.
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
    // oppenheimer:begin web
    {
      name: 'web',
      testDir: './tests/web',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: WEB_URL,
        // The web app talks to the API through Vite's `/api` proxy, so the
        // session cookie stays same-origin exactly as it does in production.
        ignoreHTTPSErrors: true,
      },
    },
    // oppenheimer:end web
  ],
});
