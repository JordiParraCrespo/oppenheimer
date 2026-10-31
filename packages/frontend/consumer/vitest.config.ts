import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  // Why the first three: `packages/frontend/core/vitest.config.ts`, which has them too. The
  // setup file says why it is there.
  test: {
    environment: 'jsdom',
    pool: 'vmThreads',
    setupFiles: ['./vitest.setup.ts'],
    exclude: [...defaultExclude, 'dist/**'],
  },
});
