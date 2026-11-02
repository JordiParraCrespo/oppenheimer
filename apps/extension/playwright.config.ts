import { defineConfig } from '@playwright/test';

/**
 * The built extension (`dist/`, so `pnpm build` first) loaded into Chromium.
 * claude.ai is played by the specs, so nothing else needs to run and no real
 * account is touched.
 */
export default defineConfig({
  testDir: './playwright',
  timeout: 30_000,
  workers: 1,
  reporter: [['list']],
});
