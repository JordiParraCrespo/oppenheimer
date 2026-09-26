/**
 * Holds the component inventory to one list: the files in `src/components/`.
 * Fails when any of the three places that register a component disagrees
 * with it.
 *
 * 1. The barrel. Every name a component file exports is re-exported from
 *    `src/index.ts`. Every component also has a `./name` subpath, but
 *    `apps/web` imports from the root, so a missing barrel entry is invisible
 *    in practice. Nobody gets an error; they just re-implement the component
 *    by hand. `Breadcrumb` sat that way until an audit went looking, by which
 *    time a detail page had already hand-rolled a breadcrumb. If something
 *    genuinely needs to stay internal, do not export it from its own module
 *    either: a non-exported helper is invisible to this check, which is the
 *    honest way to say "internal".
 * 2. The subpaths. `package.json` `exports` has `./name` for every file and no
 *    subpath for a file that is gone, so the map cannot drift from the folder.
 * 3. The showcase. Every component is imported by `apps/web-showcase` (which
 *    imports each one by subpath), or is named in `NOT_IN_SHOWCASE` with the
 *    reason. A component with neither is how forty-one of them sat in this
 *    folder unused, next to the ones an agent should reach for, until an
 *    audit removed them.
 *
 * Run: `pnpm --filter @oppenheimer/design-system-web test`
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const componentsDir = join(root, 'src', 'components');
const indexPath = join(root, 'src', 'index.ts');
const packagePath = join(root, 'package.json');

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

const componentFiles = readdirSync(componentsDir)
  .filter((file) => /\.tsx?$/.test(file))
  .sort();
const componentNames = componentFiles.map((file) => file.replace(/\.tsx?$/, ''));
const failures = [];

// 1. The barrel.
const published = exportedNames(readFileSync(indexPath, 'utf8'));
const missing = [];
for (const file of componentFiles) {
  if (NOT_IN_BARREL.has(file)) continue;
  const names = exportedNames(readFileSync(join(componentsDir, file), 'utf8'));
  const absent = [...names].filter((name) => !published.has(name)).sort();
  if (absent.length > 0) missing.push({ file, absent });
}
if (missing.length > 0) {
  failures.push(
    [
      'Unreachable exports — these are not re-exported from src/index.ts:',
      ...missing.flatMap(({ file, absent }) => [
        `  src/components/${file}`,
        ...absent.map((name) => `    · ${name}`),
      ]),
      'Add them to src/index.ts, or stop exporting them from their own module',
      'if they are meant to be internal.',
    ].join('\n'),
  );
}

// 2. The subpaths.
const { exports: subpaths } = JSON.parse(readFileSync(packagePath, 'utf8'));
const subpathProblems = [];
for (const [index, name] of componentNames.entries()) {
  const expected = `./src/components/${componentFiles[index]}`;
  if (subpaths[`./${name}`] !== expected) {
    subpathProblems.push(`  "./${name}": "${expected}" is missing`);
  }
}
for (const [key, target] of Object.entries(subpaths)) {
  if (typeof target !== 'string' || !target.startsWith('./src/components/')) continue;
  const file = target.slice('./src/components/'.length);
  if (!componentFiles.includes(file) || key !== `./${file.replace(/\.tsx?$/, '')}`) {
    subpathProblems.push(`  "${key}": "${target}" names no component file under its own name`);
  }
}
if (subpathProblems.length > 0) {
  failures.push(
    ['package.json exports disagree with src/components/:', ...subpathProblems].join('\n'),
  );
}

// oppenheimer:begin web-showcase
// 3. The showcase.
const showcaseDir = join(root, '..', '..', '..', '..', 'apps', 'web-showcase', 'src');

/**
 * Components the console uses that the showcase does not render yet, and
 * `sheet`, which only `sidebar` uses. Each should leave this list by getting a
 * showcase section; the check fails when one does, or when its file is gone,
 * so the list cannot go stale. Add to it only with a reason next to the entry.
 */
const NOT_IN_SHOWCASE = new Map([
  ['alert', 'used by the console; no showcase section yet'],
  ['badge', 'used by the console; no showcase section yet'],
  ['brand-mark', 'used by the console; no showcase section yet'],
  ['checkbox', 'used by the console; no showcase section yet'],
  ['empty', 'used by the console; no showcase section yet'],
  ['icons', 'the lucide re-export; the showcase imports lucide directly'],
  ['label', 'used by the console; no showcase section yet'],
  ['radio-group', 'used by the console; no showcase section yet'],
  ['search-input', 'used by the console; no showcase section yet'],
  ['sheet', 'internal to sidebar (its mobile drawer)'],
  ['skeleton', 'used by the console; no showcase section yet'],
  ['sonner', 'used by the console; no showcase section yet'],
  ['table', 'used by the DataTable kit; no showcase section yet'],
  ['toggle', 'used by the console; no showcase section yet'],
]);

/** Every source file under `dir`, recursively, skipping build output. */
function sourceFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(ts|tsx|mdx?)$/.test(entry.name)) files.push(path);
  }
  return files;
}

const showcaseSource = sourceFiles(showcaseDir)
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');
const showcased = (name) =>
  new RegExp(`@oppenheimer/design-system-web/${name}['"]`).test(showcaseSource);
const showcaseProblems = [];
for (const name of componentNames) {
  if (!showcased(name) && !NOT_IN_SHOWCASE.has(name)) {
    showcaseProblems.push(`  ${name}: not imported by apps/web-showcase`);
  }
}
for (const name of NOT_IN_SHOWCASE.keys()) {
  if (!componentNames.includes(name)) {
    showcaseProblems.push(`  ${name}: in NOT_IN_SHOWCASE, but the file is gone`);
  } else if (showcased(name)) {
    showcaseProblems.push(`  ${name}: in NOT_IN_SHOWCASE, but the showcase imports it now`);
  }
}
if (showcaseProblems.length > 0) {
  failures.push(
    [
      'Showcase coverage:',
      ...showcaseProblems,
      'Give a new component a showcase section (apps/web-showcase/src/lib/toc.ts),',
      'or delete it if nothing uses it. Take an entry off NOT_IN_SHOWCASE once',
      'the showcase imports it or the file is deleted.',
    ].join('\n'),
  );
}
// oppenheimer:end web-showcase

if (failures.length > 0) {
  console.error(`\n${failures.join('\n\n')}\n`);
  process.exit(1);
}

console.log(`check-exports: ${componentFiles.length} components, all registered`);
