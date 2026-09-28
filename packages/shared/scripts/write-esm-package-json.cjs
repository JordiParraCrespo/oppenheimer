#!/usr/bin/env node
/**
 * Mark `dist/esm/` as ES modules, the second half of `tsc -p tsconfig.esm.json`.
 *
 * The package itself has no `"type"`, so `dist/*.js` is CommonJS — the API and
 * the emit scripts `require()` it. `dist/esm/*.js` is the same source compiled
 * with `module: ESNext` for the `import` condition, and without a
 * `package.json` of its own saying `"type": "module"` Node and the tools that
 * follow Node's rules would read it as CommonJS too.
 *
 * It also carries `sideEffects`, rebased onto `dist/esm/`. Bundlers take that
 * flag from the *nearest* `package.json`, so a relative import between two ESM
 * files is judged by this one, not the package root's: the root list is the
 * source, and this copies its `./dist/esm/` entries.
 */
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const prefix = './dist/esm/';
const sideEffects = Array.isArray(pkg.sideEffects)
  ? pkg.sideEffects
      .filter((path) => path.startsWith(prefix))
      .map((path) => `./${path.slice(prefix.length)}`)
  : pkg.sideEffects;

const outDir = join(root, 'dist', 'esm');
mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, 'package.json'),
  `${JSON.stringify({ type: 'module', sideEffects }, null, 2)}\n`,
);
