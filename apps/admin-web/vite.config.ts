import path from 'node:path';
import { vendorChunks } from '@oppenheimer/tsconfig/vite-chunks.mjs';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  // There is one .env, at the monorepo root; a .env placed in apps/web is
  // deliberately not read. Only VITE_-prefixed values reach the client bundle.
  envDir: path.resolve(import.meta.dirname, '../..'),
  // Busts the persisted query cache on release: a version bump drops entries
  // that may not match the new response shapes.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
      autoCodeSplitting: true,
    }),
    react({
      // The React Compiler memoises components and hooks at build time, so
      // nothing here needs `useMemo`, `useCallback` or `memo` by hand. React 19
      // ships the runtime it needs; `babel-plugin-react-compiler` is the
      // plugin's peer and the only addition.
      compiler: true,
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  optimizeDeps: {
    // Workspace packages are linked, not installed, so dev has to be told to
    // pre-bundle this CommonJS entrypoint into ESM.
    include: [
      '@oppenheimer/shared/schemas/admin',
      '@oppenheimer/shared/schemas/auth',
      '@oppenheimer/shared/schemas/organization',
      '@oppenheimer/shared/schemas/profile',
      '@oppenheimer/shared/schemas/role',
      '@oppenheimer/shared/constants',
      '@oppenheimer/shared/permissions',
    ],
  },
  build: {
    rollupOptions: {
      // One chunk per library instead of one chunk for all of them, so a
      // release invalidates app code and leaves the dependencies cached. See
      // the note in `@oppenheimer/tsconfig/vite-chunks.mjs`.
      output: { manualChunks: vendorChunks },
    },
    commonjsOptions: {
      // `@oppenheimer/shared` builds to CommonJS for the API's sake. Its `dist` sits
      // outside `node_modules`, so the interop plugin skips it by default and
      // Rollup cannot see the named exports.
      include: [/node_modules/, /packages[\\/]shared[\\/]dist/],
    },
  },
  server: {
    port: 3003,
    proxy: {
      '/api': {
        // Reuse the API's canonical URL when development needs isolated ports
        // (for example parallel agent sessions); the browser remains
        // same-origin and keeps cookie auth identical to the default setup.
        target: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
