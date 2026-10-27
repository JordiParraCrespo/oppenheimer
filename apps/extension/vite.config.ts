import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { defineManifest } from './manifest.config.ts';
import pkg from './package.json' with { type: 'json' };
import { CATALOGS } from './src/i18n/catalogs.ts';

/**
 * One config, four bundles, because Chrome runs this extension in four kinds
 * of context and each wants a different file:
 *
 * - `popup` — the page: React and the design system, an ordinary ES module.
 * - `background` — the service worker: one ES module, every import inlined,
 *   since a worker may not `import()` and has no DOM to share chunks with.
 * - `tap` and `bridge` — the content scripts: classic scripts (`iife`), which
 *   is what Chrome injects, each small because it runs on every claude.ai page.
 *
 * `scripts/build.mjs` runs them in that order (`EXTENSION_TARGET`) into one
 * `dist/`, which is the unpacked extension.
 */
type Target = 'popup' | 'background' | 'tap' | 'bridge';
const target = (process.env.EXTENSION_TARGET ?? 'popup') as Target;

const scripts: Record<Exclude<Target, 'popup'>, { entry: string; format: 'es' | 'iife' }> = {
  background: { entry: 'src/background/index.ts', format: 'es' },
  tap: { entry: 'src/content/tap.ts', format: 'iife' },
  bridge: { entry: 'src/content/bridge.ts', format: 'iife' },
};

function manifest(): Plugin {
  return {
    name: 'oppenheimer:extension-manifest',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: `${JSON.stringify(defineManifest({ version: pkg.version }), null, 2)}\n`,
      });
      // What Chrome itself shows — the listing, the toolbar title — per locale.
      for (const [locale, catalog] of Object.entries(CATALOGS)) {
        const messages = Object.fromEntries(
          Object.entries(catalog.chrome).map(([key, message]) => [key, { message }]),
        );
        this.emitFile({
          type: 'asset',
          fileName: `_locales/${locale}/messages.json`,
          source: `${JSON.stringify(messages, null, 2)}\n`,
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const shared = {
    resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  };

  if (target !== 'popup') {
    const { entry, format } = scripts[target];
    return {
      ...shared,
      // Static files belong to the popup build; copying them again would race it.
      publicDir: false,
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        target: 'chrome116',
        minify: mode === 'production',
        sourcemap: mode !== 'production',
        lib: {
          entry: path.resolve(import.meta.dirname, entry),
          formats: [format],
          name: `oppenheimer_${target}`,
          fileName: () => `${target}.js`,
        },
        rolldownOptions: { output: { codeSplitting: false } },
      },
    };
  }

  return {
    ...shared,
    plugins: [
      // The React Compiler, as in every app: no `useMemo`, `useCallback` or `memo` by hand.
      react({ compiler: true }),
      tailwindcss(),
      manifest(),
    ],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      target: 'chrome116',
      sourcemap: mode !== 'production',
      // Extension pages load from disk, and the polyfill is an inline script the CSP forbids.
      modulePreload: { polyfill: false },
      rollupOptions: { input: { popup: path.resolve(import.meta.dirname, 'popup.html') } },
    },
  };
});
