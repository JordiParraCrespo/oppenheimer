import path from 'node:path';
import { frontendVitestProjects } from '@oppenheimer/tsconfig/vitest-frontend.mjs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Deliberately separate from `vite.config.ts`: a unit test needs none of its
 * router codegen, Tailwind or vendor chunking, and loading the router plugin
 * regenerates `routeTree.gen.ts`. Unit tests cover helpers, hooks and render
 * budgets; whole routes stay in `e2e/`, against a real router and API. The two
 * projects, and why one switches the React Compiler off, are
 * `@oppenheimer/tsconfig/vitest-frontend.mjs`.
 */
export default defineConfig({
  test: frontendVitestProjects({
    react,
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  }),
});
