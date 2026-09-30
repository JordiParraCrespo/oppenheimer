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
      // React 19 ships the runtime the React Compiler needs;
      // `babel-plugin-react-compiler` is the plugin's peer and the only addition.
      compiler: true,
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      // One chunk per library instead of one chunk for all of them, so a
      // release invalidates app code and leaves the dependencies cached. See
      // the note in `@oppenheimer/tsconfig/vite-chunks.mjs`.
      output: { manualChunks: vendorChunks },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        // Reuse the API's canonical URL when development needs isolated ports
        // (for example parallel agent sessions); the browser remains
        // same-origin and keeps cookie auth identical to the default setup.
        target: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
        changeOrigin: true,
        // The attach socket (`/api/v1/relay/attach`) is a WebSocket on the
        // same prefix; without this the dev server answers the upgrade itself.
        ws: true,
      },
    },
  },
});
