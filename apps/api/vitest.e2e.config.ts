import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// The relay end to end: the real Go runner, built here, against the real
// gateways. It needs `go`, `tmux`, `git` and the network, so `pnpm test` leaves
// it out; `pnpm test:relay-e2e` runs it.
export default defineConfig({
  plugins: [swc.vite()],
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.e2e.spec.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
