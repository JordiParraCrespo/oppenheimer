#!/usr/bin/env node
/**
 * Regenerate an app's `src/routeTree.gen.ts` without running a full build.
 *
 * The Vite plugin regenerates the tree on `dev` and `build`, which is the
 * normal path. This is the same generator the plugin wraps, called directly:
 * useful when you have moved route files and want the tree (and the type
 * errors it produces) in seconds rather than after a `tsc -b`.
 *
 * Usage: node .agents/skills/tanstack-routing/scripts/generate-route-tree.mjs <app-dir>
 *
 * It reads `routesDirectory`, `generatedRouteTree` and `autoCodeSplitting`
 * from the app's own `vite.config.ts` so it cannot drift from what the build
 * does. Run `pnpm --filter @oppenheimer/<app> build` before pushing anyway:
 * only that proves the tree typechecks against the routes.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
// oppenheimer:begin web
const appDir = resolve(repoRoot, process.argv[2] ?? 'apps/web');
// oppenheimer:end web

/** Pull one string/boolean option out of the app's TanStackRouterVite block. */
const readOption = (source, key, fallback) => {
  const match = source.match(new RegExp(`${key}:\\s*(?:'([^']*)'|"([^"]*)"|(true|false))`));
  if (!match) return fallback;
  const [, single, double, bool] = match;
  return bool ? bool === 'true' : (single ?? double);
};

const viteConfig = readFileSync(join(appDir, 'vite.config.ts'), 'utf8');
const config = {
  routesDirectory: readOption(viteConfig, 'routesDirectory', './src/routes'),
  generatedRouteTree: readOption(viteConfig, 'generatedRouteTree', './src/routeTree.gen.ts'),
  autoCodeSplitting: readOption(viteConfig, 'autoCodeSplitting', true),
};

// Resolved from the app's own node_modules so the generator is the version the
// plugin uses, not whatever a global install happens to hold.
const require = createRequire(join(appDir, 'package.json'));
const { Generator, getConfig } = require('@tanstack/router-generator');

await new Generator({ config: await getConfig(config, appDir), root: appDir }).run();
console.log(`${config.generatedRouteTree} regenerated from ${config.routesDirectory}`);
