#!/usr/bin/env node
/**
 * Feature-flag hygiene, checked. A flag is cheap to add and easy to forget,
 * and a codebase that forgets them ends up with hundreds of switches nobody
 * dares touch — the debt every company with a flag system writes about. So:
 *
 *  - a temporary flag (`release`, `experiment`) past its `expiresAt` fails CI,
 *    naming its owner: ship it and delete the flag, or move the date on
 *    deliberately in a reviewed diff
 *  - a flag the catalog declares but no code reads fails too: it can only be
 *    a flag whose feature was deleted and whose entry was not
 *  - a temporary flag expiring within two weeks is a warning, so the owner
 *    hears about it before the build breaks
 *
 * Reads the catalog from source (`packages/shared/src/feature-flags/catalog.ts`,
 * loaded with Node's type stripping), so it needs no build and runs in the lint
 * job. `FLAGS_TODAY=YYYY-MM-DD` pins the date. Run: pnpm check:flags
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// `fileURLToPath`, not `.pathname`: a pathname is URL-encoded, so a checkout
// under a directory with a space in it would resolve to nothing.
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const CATALOG = 'packages/shared/src/feature-flags/catalog.ts';
const WARN_WITHIN_DAYS = 14;
const SCANNED_ROOTS = ['apps', 'packages'];
const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'build', '.expo', '.next', 'coverage']);
const SOURCE = /\.(ts|tsx|mts|cts|js|jsx|mjs)$/;
/** Tests read flags to test them; a read that only a test makes is not a read. */
const TEST_FILE = /(\.spec|\.test)\.[cm]?[jt]sx?$|\/__tests__\//;

/** Days from `from` to `to`, both `YYYY-MM-DD`. */
function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * The problems in a catalog, given the text of every source file that could
 * read a flag. Pure, so the test can hand it any catalog and any tree.
 */
export function checkFeatureFlags({ catalog, today, sources }) {
  const errors = [];
  const warnings = [];

  for (const [key, definition] of Object.entries(catalog)) {
    const temporary = definition.kind !== 'ops';

    if (temporary && definition.expiresAt) {
      const left = daysBetween(today, definition.expiresAt);
      if (left <= 0) {
        errors.push(
          `${key}: a ${definition.kind} flag past its expiry (${definition.expiresAt}). ` +
            `Owner: ${definition.owner}. Ship it and delete the flag, or move expiresAt in a reviewed diff.`,
        );
      } else if (left <= WARN_WITHIN_DAYS) {
        warnings.push(
          `${key}: expires in ${left} day${left === 1 ? '' : 's'} (${definition.owner}).`,
        );
      }
    }

    // A read names the key as a string literal: useFeatureFlag('key'),
    // @RequireFlag('key'), evaluator.isEnabled('key', …).
    const literal = new RegExp(`['"\`]${key}['"\`]`);
    const readers = sources.filter((source) => literal.test(source.text));
    if (readers.length === 0) {
      errors.push(
        `${key}: declared in the catalog but read nowhere. Delete the entry, or read it where the feature is.`,
      );
    }
  }

  return { errors, warnings };
}

function collectSources(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIPPED_DIRS.has(name) || name.startsWith('.')) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      collectSources(path, out);
    } else if (SOURCE.test(name)) {
      const rel = relative(root, path);
      if (rel === CATALOG || TEST_FILE.test(rel) || rel.includes('/generated/')) continue;
      out.push({ path: rel, text: readFileSync(path, 'utf8') });
    }
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { FEATURE_FLAGS } = await import(pathToFileURL(join(root, CATALOG)).href);
  const today = process.env.FLAGS_TODAY ?? new Date().toISOString().slice(0, 10);
  const sources = SCANNED_ROOTS.flatMap((dir) => collectSources(join(root, dir)));

  const { errors, warnings } = checkFeatureFlags({ catalog: FEATURE_FLAGS, today, sources });

  for (const warning of warnings) console.warn(`  ! ${warning}`);
  if (errors.length > 0) {
    console.error(`Feature flags: ${errors.length} problem${errors.length === 1 ? '' : 's'}\n`);
    for (const error of errors) console.error(`  ✖ ${error}`);
    console.error(`\nSee ${CATALOG}`);
    process.exit(1);
  }
  console.log(
    `Feature flags: ${Object.keys(FEATURE_FLAGS).length} declared, all read, none expired.`,
  );
}
