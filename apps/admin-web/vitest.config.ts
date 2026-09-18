import path from 'node:path';
import { frontendVitestProjects } from '@oppenheimer/tsconfig/vitest-frontend.mjs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Deliberately separate from `vite.config.ts`. The app config carries the
 * router codegen plugin, Tailwind, and a `commonjsOptions` block for
 * `@oppenheimer/shared`'s CJS build — none of which a unit test needs, and the router
 * plugin regenerates `routeTree.gen.ts` as a side effect of being loaded.
 *
 * What unit tests cover here is `src/lib/`, the app-shell hooks and the render
 * budgets: the pure helpers, the hooks that hold URL and query state, and the
 * handful of components whose cost is the thing worth asserting. Rendering
 * whole routes stays in `e2e/`, where a real router and a real API make the
 * assertions worth their runtime.
 *
 * The two projects — and why one of them switches the React Compiler off — are
 * `@oppenheimer/tsconfig/vitest-frontend.mjs`.
 */
export default defineConfig({
  test: frontendVitestProjects({
    react,
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  }),
});
