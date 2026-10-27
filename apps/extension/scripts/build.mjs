#!/usr/bin/env node
/**
 * Builds the unpacked extension into `dist/`.
 *
 *   node scripts/build.mjs           # production: minified, no source maps
 *   node scripts/build.mjs --watch   # development: rebuild on save
 *
 * Four Vite builds into one folder, in order: the popup (which empties
 * `dist/` and writes `manifest.json`), the service worker, and the two
 * content scripts. Why four is the header of `vite.config.ts`. After a
 * rebuild in watch mode, press reload on the extension in chrome://extensions.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS = ['popup', 'background', 'tap', 'bridge'];

const watch = process.argv.includes('--watch');
const mode = watch ? 'development' : 'production';

// Sequential: the popup build empties `dist/` first, and Vite reads
// `EXTENSION_TARGET` when it loads the config.
for (const target of TARGETS) {
  process.env.EXTENSION_TARGET = target;
  await build({
    root: APP,
    configFile: resolve(APP, 'vite.config.ts'),
    mode,
    logLevel: watch ? 'warn' : 'info',
    build: watch ? { watch: {} } : {},
  });
}

if (watch) console.log('\n  Watching. Load apps/extension/dist from chrome://extensions once.\n');
