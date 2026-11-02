import path from 'node:path';
import { vendorChunks } from '@oppenheimer/tsconfig/vite-chunks.mjs';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

/**
 * Source maps for Sentry, only when the build can upload them
 * (`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_WEB_PROJECT`): `hidden` leaves
 * no `sourceMappingURL` in the bundle, and the plugin deletes the maps once
 * uploaded, so none is ever served. The release matches what the client
 * reports (`createWebErrorReportingClient`). Never `VITE_`-prefixed: the
 * token stays out of the bundle.
 */
const sentryUpload =
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_WEB_PROJECT
    ? sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_WEB_PROJECT,
        release: { name: process.env.VITE_SENTRY_RELEASE || pkg.version },
        sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
        telemetry: false,
      })
    : null;

export default defineConfig({
  // There is one .env, at the monorepo root; a .env placed in apps/web is
  // deliberately not read. Only VITE_-prefixed values reach the client bundle.
  envDir: path.resolve(import.meta.dirname, '../..'),
  // The persisted query cache's buster (`providers/query-provider.tsx`).
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
      // the compiler itself is `oxc-transform-react`, the only addition.
      compiler: true,
    }),
    tailwindcss(),
    sentryUpload,
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
    // One zod for the console, the app's own (3.x). The workspace's root copy
    // is zod 4 for the API's agent SDKs (`@oppenheimer/backend-agents`), and a
    // dependency hoisted beside it (`@hookform/resolvers`) would otherwise
    // bundle that second zod into the forms chunk.
    dedupe: ['zod'],
  },
  build: {
    sourcemap: sentryUpload ? 'hidden' : false,
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
