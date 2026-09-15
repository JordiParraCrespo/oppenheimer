/**
 * Fails when a component file exports something the package entry point does
 * not re-export.
 *
 * Every component also has a `./name` subpath in package.json, so a missing
 * barrel entry is not *technically* unreachable — but every consumer in this
 * repo imports from the root, so in practice it is invisible. Nobody gets an
 * error; they just re-implement the component by hand. `Breadcrumb` and
 * `Collapsible` sat that way until an audit went looking, by which time the
 * lead detail page had already hand-rolled a breadcrumb.
 *
 * The rule is deliberately absolute: everything a file in `src/components/`
 * exports belongs in the barrel. If something genuinely needs to stay internal,
 * do not export it from its own module either — a non-exported helper is
 * invisible to this check, which is the honest way to say "internal".
 *
 * Run: `pnpm --filter @oppenheimer/design-system-web test`
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const componentsDir = join(root, 'src', 'components');
const indexPath = join(root, 'src', 'index.ts');

/**
 * Files deliberately left out of the barrel. Keep this at zero or one entry —
 * an exception you have to justify in writing is the whole point of the list.
 *
 * `icons.tsx` re-exports the whole of lucide. Pulling that into the barrel
 * would put every icon in the graph of anyone importing a Button, so it ships
 * only as `@oppenheimer/design-system-web/icons`, which is how every app already
 * imports icons.
 */
const NOT_IN_BARREL = new Set(['icons.tsx']);

/**
 * Two export forms the barrel cannot express, flagged by name so the failure
 * explains itself. `export *` re-exports symbols this script cannot enumerate
 * without resolving the target; `export default` has no name for `index.ts` to
 * re-export. Neither appears in the package today — this keeps it that way,
 * rather than letting a component slip past the check by using one.
 */
const WILDCARD_REEXPORT = '<a wildcard `export *`, which the barrel cannot enumerate>';
const DEFAULT_EXPORT = '<a default export, which the barrel cannot name>';

/** Every name in `export { ... }` / `export function X` / `export const X`. */
function exportedNames(source) {
  const names = new Set();

  for (const match of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const entry of match[1].split(',')) {
      // `Foo as Bar` is published as `Bar`; `type Foo` is published as `Foo`.
      const name = entry
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name) names.add(name);
    }
  }
  // `export function` / `async function` / `function*`, and `export class`.
  for (const match of source.matchAll(
    /export\s+(?:async\s+)?(?:function\s*\*?|class)\s+([A-Za-z0-9_$]+)/g,
  )) {
    names.add(match[1]);
  }
  // `export const|let|var Foo`, including `const Foo, Bar` on one statement.
  for (const match of source.matchAll(/export\s+(?:const|let|var)\s+([A-Za-z0-9_$,\s]+?)[=:;]/g)) {
    for (const name of match[1].split(',')) {
      const trimmed = name.trim();
      if (trimmed) names.add(trimmed);
    }
  }
  for (const match of source.matchAll(/export\s+(?:type|interface|enum)\s+([A-Za-z0-9_$]+)/g)) {
    names.add(match[1]);
  }
  // `export * from './x'` re-exports names this file cannot enumerate, and
  // `export default` publishes something the barrel cannot name at all.
  // Both defeat the check, so they are refused outright rather than passed over.
  if (/export\s+\*/.test(source)) names.add(WILDCARD_REEXPORT);
  if (/export\s+default\b/.test(source)) names.add(DEFAULT_EXPORT);

  return names;
}

const published = exportedNames(readFileSync(indexPath, 'utf8'));
const missing = [];

for (const file of readdirSync(componentsDir).sort()) {
  if (!/\.tsx?$/.test(file)) continue;
  if (NOT_IN_BARREL.has(file)) continue;

  const names = exportedNames(readFileSync(join(componentsDir, file), 'utf8'));
  const absent = [...names].filter((name) => !published.has(name)).sort();
  if (absent.length > 0) missing.push({ file, absent });
}

if (missing.length > 0) {
  console.error('\nUnreachable exports — these are not re-exported from src/index.ts:\n');
  for (const { file, absent } of missing) {
    console.error(`  src/components/${file}`);
    for (const name of absent) console.error(`    · ${name}`);
  }
  console.error(
    '\nAdd them to src/index.ts, or stop exporting them from their own module\n' +
      'if they are meant to be internal.\n',
  );
  process.exit(1);
}

console.log(`check-exports: every export in src/components/ is reachable from src/index.ts`);
