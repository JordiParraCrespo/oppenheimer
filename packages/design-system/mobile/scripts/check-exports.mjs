/**
 * Fails when a component is unreachable from outside the package.
 *
 * The mobile package publishes two ways in — the barrel at `src/index.ts` and a
 * per-component subpath in `package.json`'s `exports` map — so it has two ways
 * to leave a component stranded, and the web package's equivalent check only
 * covers the first. Both are checked here:
 *
 *   1. everything a file in `src/components/ui/` exports is re-exported from
 *      `src/index.ts`, and
 *   2. every component file has a `./name` entry in the `exports` map.
 *
 * The failure mode is not a crash — it is silent duplication. Nobody gets an
 * import error; they conclude the component does not exist and hand-roll it,
 * and the design system quietly stops being the source of truth.
 *
 * Run: `pnpm --filter @oppenheimer/design-system-mobile test`
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const componentsDir = join(root, 'src', 'components', 'ui');
const indexPath = join(root, 'src', 'index.ts');
const packagePath = join(root, 'package.json');

/**
 * Files deliberately left out of the barrel. Keep this at zero or one entry —
 * an exception you have to justify in writing is the whole point of the list.
 *
 * `icons.tsx` re-exports from lucide-react-native. Pulling that into the barrel
 * would put every icon in the graph of anyone importing a Button, so it ships
 * only as `@oppenheimer/design-system-mobile/icons`, which is how `apps/mobile`
 * already imports icons.
 */
const NOT_IN_BARREL = new Set(['icons.tsx', 'native-only-animated-view.tsx']);

/**
 * The one component that is genuinely internal. It exists so the nine overlay
 * components can wrap their content in a Reanimated view on native and a plain
 * one on web; it has no standalone use and no app imports it. It cannot simply
 * stop exporting itself — its siblings import it by name — so it is named here
 * instead, and is exempt from the subpath rule as well as the barrel one.
 */
const NOT_PUBLISHED = new Set(['native-only-animated-view']);

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
  if (/export\s+\*/.test(source)) names.add(WILDCARD_REEXPORT);
  if (/export\s+default\b/.test(source)) names.add(DEFAULT_EXPORT);

  return names;
}

const published = exportedNames(readFileSync(indexPath, 'utf8'));
const subpaths = new Set(Object.keys(JSON.parse(readFileSync(packagePath, 'utf8')).exports ?? {}));

const files = readdirSync(componentsDir)
  .filter((file) => /\.tsx?$/.test(file))
  .sort();

const missingFromBarrel = [];
const missingFromExports = [];

for (const file of files) {
  const base = file.replace(/\.tsx?$/, '');
  if (!NOT_PUBLISHED.has(base) && !subpaths.has(`./${base}`)) missingFromExports.push(base);

  if (NOT_IN_BARREL.has(file)) continue;
  const names = exportedNames(readFileSync(join(componentsDir, file), 'utf8'));
  const absent = [...names].filter((name) => !published.has(name)).sort();
  if (absent.length > 0) missingFromBarrel.push({ file, absent });
}

let failed = false;

if (missingFromBarrel.length > 0) {
  failed = true;
  console.error('\nUnreachable exports — these are not re-exported from src/index.ts:\n');
  for (const { file, absent } of missingFromBarrel) {
    console.error(`  src/components/ui/${file}`);
    for (const name of absent) console.error(`    · ${name}`);
  }
  console.error(
    '\nAdd them to src/index.ts, or stop exporting them from their own module\n' +
      'if they are meant to be internal.\n',
  );
}

if (missingFromExports.length > 0) {
  failed = true;
  console.error('\nComponents with no subpath in package.json "exports":\n');
  for (const base of missingFromExports) {
    console.error(`    · "./${base}": "./src/components/ui/${base}.tsx"`);
  }
  console.error('\nAdd the lines above to the "exports" map.\n');
}

if (failed) process.exit(1);

console.log(
  `check-exports: ${files.length} components reachable from both src/index.ts and the exports map`,
);
