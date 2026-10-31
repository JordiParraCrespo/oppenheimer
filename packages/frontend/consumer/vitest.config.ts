import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  // Why each setting: `packages/frontend/core/vitest.config.ts`, which has the same three.
  test: {
    environment: 'jsdom',
    pool: 'vmThreads',
    exclude: [...defaultExclude, 'dist/**'],
  },
});
