/**
 * Holds the design system to one inventory. `src/components/` is the public
 * set and `src/internal/` the building blocks only those components import;
 * the showcase's `toc.ts` names every public file once, under the section that
 * shows it. Fails when the folder and anything that registers it disagree:
 *
 * 1. The barrel. Every name a component exports is re-exported from
 *    `src/index.ts` (apps import from the root, so a missing entry is a
 *    component nobody finds), and nothing in `src/internal/` is.
 * 2. The subpaths. `package.json` maps `./*` onto `src/components/`, so a new
 *    file needs no entry there, and no other key may point into either folder.
 * 3. The internals. Each file in `src/internal/` is imported by a component;
 *    one nothing imports is dead and gets deleted.
 * 4. The inventory. Every component is listed in exactly one `toc.ts` item's
 *    `components`, every listed name is a file, and the showcase has a real
 *    `import … from '@oppenheimer/design-system-web/<name>'` for it (a comment
 *    or a string does not count).
 *
 * Internal means not exported from the package: a file in `src/internal/` is
 * reachable only through the component that wraps it.
 *
 * Run: `pnpm --filter @oppenheimer/design-system-web test`
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const componentsDir = join(root, 'src', 'components');
const internalDir = join(root, 'src', 'internal');
const indexPath = join(root, 'src', 'index.ts');
const packagePath = join(root, 'package.json');

/**
 * `icons.tsx` re-exports the whole of lucide. Pulling that into the barrel
 * would put every icon in the graph of anyone importing a Button, so it ships
 * only as `@oppenheimer/design-system-web/icons`.
 */
const NOT_IN_BARREL = new Set(['icons.tsx']);

/**
 * Two export forms the barrel cannot express, flagged by name so the failure
 * explains itself: `export *` re-exports symbols this script cannot enumerate,
 * and `export default` has no name for `index.ts` to re-export.
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

/** Source files directly in `dir`, as names without their extension. */
function moduleNames(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => /\.tsx?$/.test(file))
    .sort()
    .map((file) => file.replace(/\.tsx?$/, ''));
}

/** The module specifiers of every real import declaration in `source`. */
function importSpecifiers(source) {
  return [...source.matchAll(/^\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
}

const componentFiles = readdirSync(componentsDir)
  .filter((file) => /\.tsx?$/.test(file))
  .sort();
const componentNames = moduleNames(componentsDir);
const internalNames = moduleNames(internalDir);
const failures = [];

// 1. The barrel.
const indexSource = readFileSync(indexPath, 'utf8');
const published = exportedNames(indexSource);
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
      'Add them to src/index.ts, or move the file to src/internal/ if only',
      'another component uses it.',
    ].join('\n'),
  );
}
const leaked = [...indexSource.matchAll(/from\s+['"](\.\/internal\/[^'"]+)['"]/g)].map((m) => m[1]);
if (leaked.length > 0) {
  failures.push(
    [
      'src/index.ts exports from src/internal/, which is not public:',
      ...leaked.map((spec) => `  ${spec}`),
      'Move the file to src/components/ (and give it a showcase section) to publish it.',
    ].join('\n'),
  );
}

// 2. The subpaths.
const { exports: subpaths } = JSON.parse(readFileSync(packagePath, 'utf8'));
const subpathProblems = [];
if (subpaths['./*'] !== './src/components/*.tsx') {
  subpathProblems.push('  "./*" must map to "./src/components/*.tsx"');
}
for (const [key, target] of Object.entries(subpaths)) {
  if (key === './*' || typeof target !== 'string') continue;
  if (/^\.\/src\/(components|internal)\//.test(target)) {
    subpathProblems.push(`  "${key}": "${target}" — components are reached through "./*" only`);
  }
}
if (subpathProblems.length > 0) {
  failures.push(['package.json exports:', ...subpathProblems].join('\n'));
}

// 3. The internals.
const componentImports = componentFiles.flatMap((file) =>
  importSpecifiers(readFileSync(join(componentsDir, file), 'utf8')),
);
const unusedInternals = internalNames.filter(
  (name) => !componentImports.includes(`../internal/${name}`),
);
if (unusedInternals.length > 0) {
  failures.push(
    [
      'src/internal/ files no component imports:',
      ...unusedInternals.map((name) => `  ${name}`),
      'Delete them; git keeps them.',
    ].join('\n'),
  );
}

// oppenheimer:begin web-showcase
// 4. The inventory.
const showcaseDir = join(root, '..', '..', '..', '..', 'apps', 'web-showcase', 'src');
const tocPath = join(showcaseDir, 'lib', 'toc.ts');

function sourceFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry.name)) files.push(path);
  }
  return files;
}

const listed = new Map();
for (const match of readFileSync(tocPath, 'utf8').matchAll(
  /id:\s*'([^']+)'[^}]*?components:\s*\[([^\]]*)\]/g,
)) {
  for (const name of match[2].match(/'[^']+'/g) ?? []) {
    const file = name.slice(1, -1);
    listed.set(file, [...(listed.get(file) ?? []), match[1]]);
  }
}
const showcaseImports = new Set(
  sourceFiles(showcaseDir)
    .flatMap((path) => importSpecifiers(readFileSync(path, 'utf8')))
    .filter((spec) => spec.startsWith('@oppenheimer/design-system-web/'))
    .map((spec) => spec.slice('@oppenheimer/design-system-web/'.length)),
);
const inventoryProblems = [];
for (const name of componentNames) {
  const items = listed.get(name) ?? [];
  if (items.length === 0) inventoryProblems.push(`  ${name}: in no toc.ts item's components`);
  if (items.length > 1) inventoryProblems.push(`  ${name}: listed by ${items.join(', ')}`);
  if (!showcaseImports.has(name)) {
    inventoryProblems.push(
      `  ${name}: the showcase never imports @oppenheimer/design-system-web/${name}`,
    );
  }
}
for (const [name, items] of listed) {
  if (!componentNames.includes(name)) {
    inventoryProblems.push(
      `  ${name}: listed by ${items.join(', ')}, but src/components/ has no such file`,
    );
  }
}
if (inventoryProblems.length > 0) {
  failures.push(
    [
      'Inventory (apps/web-showcase/src/lib/toc.ts):',
      ...inventoryProblems,
      'A public component gets a <Spec> on the showcase page and its file name in',
      "that item's components. One only another component uses belongs in",
      'src/internal/; one nothing uses is deleted.',
    ].join('\n'),
  );
}
// oppenheimer:end web-showcase

if (failures.length > 0) {
  console.error(`\n${failures.join('\n\n')}\n`);
  process.exit(1);
}

console.log(
  `check-exports: ${componentNames.length} components, ${internalNames.length} internal, all accounted for`,
);
