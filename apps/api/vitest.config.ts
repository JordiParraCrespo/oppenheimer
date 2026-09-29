import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite()],
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    // Integration suites need Docker; `pnpm test:integration` runs them.
    exclude: ['src/**/*.integration.spec.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
