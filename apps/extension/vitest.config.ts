import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Separate from `vite.config.ts`, which builds four targets and emits a
 * manifest — none of which a unit test needs. What runs here is the logic
 * under the surfaces: reading a session, folding a list in, the manifest.
 * The built extension in a real Chromium is `playwright/`'s job.
 */
export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
