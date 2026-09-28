#!/usr/bin/env node
/**
 * Import every entry of the ESM build in plain Node, the last step of `build`.
 *
 * Bundlers forgive an extensionless or directory specifier (`'./constants'`);
 * Node's ESM loader does not, and fails the whole import with
 * `ERR_UNSUPPORTED_DIR_IMPORT` or `ERR_MODULE_NOT_FOUND`. So every relative
 * import in `src/` is fully specified (`'./constants/index.js'`,
 * `'./link.js'`), and this proves the output still loads the way a Node ESM
 * consumer (a script, a test runner without a bundler) would load it: through
 * each entry the `exports` map's `import` condition can point at.
 */
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const esm = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'esm');

const entries = [join(esm, 'index.js'), join(esm, 'feature-flags', 'catalog.js')];
for (const dir of readdirSync(esm, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const index = join(esm, dir.name, 'index.js');
  if (existsSync(index)) entries.push(index);
}
for (const file of readdirSync(join(esm, 'schemas'))) {
  if (file.endsWith('.schema.js')) entries.push(join(esm, 'schemas', file));
}

const failures = [];
for (const entry of entries) {
  try {
    await import(pathToFileURL(entry).href);
  } catch (error) {
    failures.push(`${entry}: ${error.code ?? ''} ${error.message}`);
  }
}
if (failures.length > 0) {
  console.error(
    `The ESM build does not load in Node — a relative import in src/ is not fully specified (add .js, or /index.js for a directory):\n${failures.join('\n')}`,
  );
  process.exit(1);
}
console.log(`ESM build loads in Node (${entries.length} entries)`);
