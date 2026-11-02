#!/usr/bin/env node
/**
 * Rebuilds `{locale}/index.json` — and `{locale}/browser.json`, the same
 * without the namespaces no browser reads — from the per-area namespace files.
 * The namespace files are the source of truth; the merged `index.json` is what
 * the API's translator loads, every locale at once.
 *
 * `--check` writes nothing and fails when a committed file differs from what
 * it would write: the lint job's check that the catalogs were reassembled.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const stale = [];

function emit(locale, name, catalog) {
  const file = join(root, locale, name);
  const text = `${JSON.stringify(catalog, null, 2)}\n`;
  if (!check) {
    writeFileSync(file, text);
    console.log(`assembled ${locale}/${name}`);
  } else if (!existsSync(file) || readFileSync(file, 'utf8') !== text) {
    stale.push(`${locale}/${name}`);
  }
}
const namespaces = JSON.parse(readFileSync(join(root, 'namespaces.json'), 'utf8'));

/**
 * Namespaces no browser app reads, which `browser.json` leaves out: the web
 * app bundles the default locale's catalog in its entry chunk, and a namespace
 * no screen renders is weight every first visit pays.
 *
 * - `emails`: the API's email templates.
 * - `extension`: the Chrome extension's popup, notifications and listing,
 *   which it imports from `{locale}/extension.json` directly.
 *
 * A screen that starts reading a namespace on this list takes it off.
 */
const NOT_IN_BROWSER = ['emails', 'extension'];

for (const locale of readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^[a-z]{2}$/.test(entry.name))
  .map((entry) => entry.name)) {
  const catalog = {};
  for (const ns of namespaces) {
    const file = join(root, locale, `${ns}.json`);
    catalog[ns] = JSON.parse(readFileSync(file, 'utf8'));
  }
  emit(locale, 'index.json', catalog);
  const browser = Object.fromEntries(
    Object.entries(catalog).filter(([ns]) => !NOT_IN_BROWSER.includes(ns)),
  );
  emit(locale, 'browser.json', browser);
}

if (stale.length) {
  console.error(
    `Not assembled from their namespaces: ${stale.join(', ')}. Run \`pnpm --filter @oppenheimer/translations assemble\`.`,
  );
  process.exit(1);
}
if (check) console.log('every catalog matches its namespaces');
