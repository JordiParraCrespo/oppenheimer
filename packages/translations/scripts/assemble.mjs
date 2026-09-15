#!/usr/bin/env node
/**
 * Rebuilds `{locale}/index.json` from the per-area namespace files.
 * The namespace files are the source of truth; the merged file exists so
 * `@oppenheimer/translations/en` (JSON) and the API translator keep working.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const namespaces = JSON.parse(readFileSync(join(root, 'namespaces.json'), 'utf8'));

for (const locale of readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^[a-z]{2}$/.test(entry.name))
  .map((entry) => entry.name)) {
  const catalog = {};
  for (const ns of namespaces) {
    const file = join(root, locale, `${ns}.json`);
    catalog[ns] = JSON.parse(readFileSync(file, 'utf8'));
  }
  writeFileSync(join(root, locale, 'index.json'), `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`assembled ${locale}/index.json`);
}
