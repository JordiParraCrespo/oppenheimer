#!/usr/bin/env node
/**
 * Rebuilds `{locale}/index.json` — and `{locale}/browser.json`, the same
 * without the namespaces no browser reads — from the per-area namespace files.
 * The namespace files are the source of truth; the merged file exists so
 * `@oppenheimer/translations/en` (JSON) and the API translator keep working.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const namespaces = JSON.parse(readFileSync(join(root, 'namespaces.json'), 'utf8'));

/**
 * Namespaces no browser app reads, which `browser.json` leaves out: the web
 * app bundles the default locale's catalog in its entry chunk, and a namespace
 * no screen renders is weight every first visit pays.
 *
 * - `emails`: the API's email templates. A screen that starts reading a
 *   namespace on this list takes it off.
 */
const NOT_IN_BROWSER = ['emails'];

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
  const browser = Object.fromEntries(
    Object.entries(catalog).filter(([ns]) => !NOT_IN_BROWSER.includes(ns)),
  );
  writeFileSync(join(root, locale, 'browser.json'), `${JSON.stringify(browser, null, 2)}\n`);
  console.log(`assembled ${locale}/browser.json`);
}
