import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * An error code is a four-part contract (see `.agents/rules/nestjs-architecture.md`):
 * the catalog entry, an `@ApiProblemResponse` on the endpoint, a row in
 * `errors.md`, and a message in every locale.
 *
 * The first is the only part the compiler sees. This covers the two that are
 * silently skippable: a missing docs row makes the problem `type` URI a dead
 * link, and a missing translation drops every client back to a generic
 * sentence.
 */

const SRC = resolve(__dirname, '..');
const REPO_ROOT = resolve(__dirname, '../../../..');
const ERRORS_DOC = join(REPO_ROOT, 'apps/docs/docs/errors.md');
const TRANSLATIONS = join(REPO_ROOT, 'packages/translations');

/** Every code declared in an `*.errors.ts` catalog. */
function catalogCodes(): string[] {
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.errors.ts')) files.push(path);
    }
  };
  walk(SRC);

  return files.flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(/code:\s*'([A-Z][A-Z0-9_]*)'/g)].map(
      (match) => match[1],
    ),
  );
}

function documentedCodes(): Set<string> {
  const doc = readFileSync(ERRORS_DOC, 'utf8');
  return new Set([...doc.matchAll(/`([A-Z][A-Z0-9_]*)`\s*<a id=/g)].map((match) => match[1]));
}

function localeCodes(locale: string): Set<string> {
  const bundle = JSON.parse(readFileSync(join(TRANSLATIONS, locale, 'index.json'), 'utf8'));
  return new Set(Object.keys(bundle.errors?.byCode ?? {}));
}

const codes = catalogCodes();
const locales = readdirSync(TRANSLATIONS, { withFileTypes: true })
  // Locale directories contain a compiled index bundle. Other package folders,
  // such as scripts and caches, can live beside them.
  .filter(
    (entry) => entry.isDirectory() && existsSync(join(TRANSLATIONS, entry.name, 'index.json')),
  )
  .map((entry) => entry.name);

describe('error catalog coverage', () => {
  it('finds the catalogs and locales to check', () => {
    expect(codes.length).toBeGreaterThan(20);
    expect(locales.length).toBeGreaterThan(1);
  });

  it('declares each code exactly once', () => {
    const duplicates = codes.filter((code, index) => codes.indexOf(code) !== index);
    expect([...new Set(duplicates)]).toEqual([]);
  });

  it('documents every code in errors.md', () => {
    // The problem `type` URI is an anchor on that page, so an undocumented
    // code points clients at a dead link.
    const documented = documentedCodes();
    expect(codes.filter((code) => !documented.has(code))).toEqual([]);
  });

  it('translates every code in every locale', () => {
    const missing = locales.flatMap((locale) => {
      const translated = localeCodes(locale);
      return codes.filter((code) => !translated.has(code)).map((code) => `${locale}: ${code}`);
    });
    expect(missing).toEqual([]);
  });
});
