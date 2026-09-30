import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  // Why each setting: `packages/frontend/core/vitest.config.ts`, which has the same two.
  test: {
    environment: 'jsdom',
    exclude: [...defaultExclude, 'dist/**'],
  },
});
