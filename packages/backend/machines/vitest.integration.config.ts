import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.integration.spec.ts'],
    testTimeout: 60 * 60_000,
    hookTimeout: 60 * 60_000,
  },
});
