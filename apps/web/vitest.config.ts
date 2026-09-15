import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Deliberately separate from `vite.config.ts`. The app config carries the
 * router codegen plugin, Tailwind, and a `commonjsOptions` block for
 * `@oppenheimer/shared`'s CJS build — none of which a unit test needs, and the router
 * plugin regenerates `routeTree.gen.ts` as a side effect of being loaded.
 *
 * What unit tests cover here is `src/lib/` and the app-shell hooks: the pure
 * helpers and the hooks that hold URL and query state. Rendering whole routes
 * stays in `e2e/`, where a real router and a real API make the assertions
 * worth their runtime.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
  },
});
