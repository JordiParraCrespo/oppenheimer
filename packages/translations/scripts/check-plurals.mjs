#!/usr/bin/env node
/**
 * Every counted string has every plural form its locale uses.
 *
 * i18next picks `key_one`, `key_many` or `key_other` with `Intl.PluralRules`,
 * and Spanish uses `many` for exact millions ("1 000 000 de líneas"). A
 * counted key with `_one` and `_other` but no `_many` shows the raw key at a
 * million. `_zero` is an i18next extra, never required. Ordinal keys
 * (`_ordinal_*`) follow the ordinal rules, which no catalog uses yet.
 *
 * Run: node packages/translations/scripts/check-plurals.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];
const SUFFIX = new RegExp(`^(.*)_(${CATEGORIES.join('|')})$`);

function* leaves(node, path = []) {
  for (const [key, value] of Object.entries(node)) {
    if (value && typeof value === 'object') yield* leaves(value, [...path, key]);
    else yield [...path, key];
  }
}

/**
 * The counted keys of one catalog that miss a form the locale needs.
 *
 * @param {string} locale a BCP 47 tag, as the catalog's directory is named
 * @param {Record<string, unknown>} catalog one namespace file, parsed
 * @returns {Array<{ key: string, missing: string[] }>}
 */
export function pluralGaps(locale, catalog) {
  const required = CATEGORIES.filter((form) =>
    new Intl.PluralRules(locale).resolvedOptions().pluralCategories.includes(form),
  );
  const counted = new Map();
  for (const path of leaves(catalog)) {
    const last = path.at(-1);
    const match = SUFFIX.exec(last);
    if (!match || match[1].endsWith('_ordinal')) continue;
    const base = [...path.slice(0, -1), match[1]].join('.');
    if (!counted.has(base)) counted.set(base, new Set());
    counted.get(base).add(match[2]);
  }
  const gaps = [];
  for (const [key, forms] of counted) {
    const missing = required.filter((form) => !forms.has(form));
    if (missing.length) gaps.push({ key, missing });
  }
  return gaps;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const locales = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !['scripts', 'node_modules'].includes(e.name))
    .map((e) => e.name);
  const problems = [];
  for (const locale of locales) {
    for (const file of readdirSync(join(root, locale))) {
      if (!file.endsWith('.json') || file === 'index.json' || file === 'browser.json') continue;
      const catalog = JSON.parse(readFileSync(join(root, locale, file), 'utf8'));
      for (const { key, missing } of pluralGaps(locale, catalog)) {
        problems.push(`${locale}/${file}: ${key} has no ${missing.map((m) => `_${m}`).join(', ')}`);
      }
    }
  }
  if (problems.length) {
    console.error(
      `Plural forms: ${problems.length} counted key(s) miss a form their locale uses\n`,
    );
    for (const p of problems) console.error(`  ✖ ${p}`);
    process.exit(1);
  }
  console.log(`Plural forms: every counted key in ${locales.join(', ')} has its locale's forms.`);
}
