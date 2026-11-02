#!/usr/bin/env node
/**
 * The component catalog cannot drift from the design system.
 *
 * "Reach for the design system before writing markup" is a table: the table
 * in `.agents/rules/frontend-ui.md` and the rest of it in
 * `.agents/reference/frontend-ui-catalog.md`. Its "Use" and "Not" columns are
 * judgement, which no export carries, so the table is written by hand. What a
 * script can hold is the link between the two, read from the "Use" column
 * only:
 *
 * - every component a row's "Use" column names is a public export of the
 *   design system or of the platform kit, or a part of a public compound
 *   (`QueryState.Pending`), resolved through each package's barrel by the
 *   TypeScript compiler, `export *` included;
 * - every design-system module that exports a component is named in some
 *   row's "Use" column, or opens with `// uncatalogued: <why>`. A marker on a
 *   module that has a row is stale, and fails too.
 *
 * Run: `pnpm check:ui-catalog`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ts = createRequire(import.meta.url)('typescript');

export const CATALOG_FILES = [
  '.agents/rules/frontend-ui.md',
  '.agents/reference/frontend-ui-catalog.md',
];
export const DESIGN_SYSTEM_INDEX = 'packages/frontend/design-system/web/src/index.ts';
export const KIT_INDEX = 'packages/frontend/web/src/index.ts';

const MARKER = /^\s*\/\/\s*uncatalogued:(.*)$/m;
const COMPONENT = /^[A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*$/;

/** A component's name: PascalCase with a lower-case letter, so not `AVATAR_GRADIENTS` or `badgeVariants`. */
export const isComponentName = (name) => COMPONENT.test(name);

const COMPILER_OPTIONS = {
  jsx: ts.JsxEmit.ReactJSX,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ES2022,
  lib: ['lib.es2022.d.ts'],
  skipLibCheck: true,
  noEmit: true,
  types: [],
};

/**
 * A program over `roots` that reads only the sources under `ownDirs` (and
 * TypeScript's own lib). Everything else they import (React, Base UI, the
 * kernel) resolves to an empty module: an export's name and the parts of a
 * compound do not depend on it, and parsing it is most of the time a full
 * program takes (about 3.5 s against 1.5 s).
 */
export function createCatalogProgram(roots, ownDirs) {
  const own = ownDirs.map((dir) => `${resolve(dir)}/`);
  const host = ts.createCompilerHost(COMPILER_OPTIONS);
  const read = host.getSourceFile.bind(host);
  host.getSourceFile = (file, language, ...rest) =>
    own.some((dir) => resolve(file).startsWith(dir)) || /[\\/]typescript[\\/]lib[\\/]/.test(file)
      ? read(file, language, ...rest)
      : ts.createSourceFile(file, 'export {};', language);
  return ts.createProgram(roots, COMPILER_OPTIONS, host);
}

/**
 * Whether a barrel's export is a value the catalog can name. A symbol with no
 * declarations is kept: it is a re-export from a stubbed module.
 */
export function isCataloguedValueExport(target) {
  return !target.declarations?.length || Boolean(target.flags & ts.SymbolFlags.Value);
}

/** The leading PascalCase name of each backticked span in a table row's "Use" cell, with its line. */
export function useColumnNames(text) {
  const names = [];
  text.split('\n').forEach((line, index) => {
    if (!line.startsWith('| ') || /^\|\s*-/.test(line) || /^\|\s*Need\s*\|/.test(line)) return;
    const use = line.split(' | ')[1];
    if (!use) return;
    for (const code of use.matchAll(/`([^`]+)`/g)) {
      const name = code[1].match(/^([A-Z][A-Za-z0-9]*)/)?.[1];
      if (name) names.push({ line: index + 1, name });
    }
  });
  return names;
}

/**
 * The value exports of each barrel, as the compiler resolves them.
 * Returns `{ designSystem: Map<name, file>, kit: Set<name> }`: the design
 * system's exports keyed to the module that declares them, and every name the
 * kit makes public, compound parts of its public values included.
 */
export function publicExports(designSystemIndex, kitIndex) {
  const roots = [designSystemIndex, kitIndex].filter((file) => file && existsSync(file));
  const program = createCatalogProgram(
    roots,
    roots.map((file) => dirname(file)),
  );
  const checker = program.getTypeChecker();

  function valueExports(file) {
    const source = program.getSourceFile(file);
    const module = source && checker.getSymbolAtLocation(source);
    if (!module) return [];
    return checker.getExportsOfModule(module).flatMap((symbol) => {
      const target =
        symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      return isCataloguedValueExport(target) ? [{ name: symbol.getName(), symbol, target }] : [];
    });
  }

  const designSystem = new Map();
  for (const { name, target } of valueExports(designSystemIndex)) {
    const file = target.declarations?.[0]?.getSourceFile().fileName;
    if (file) designSystem.set(name, file);
  }

  const kit = new Set();
  const source = program.getSourceFile(kitIndex);
  for (const { name, symbol } of valueExports(kitIndex)) {
    kit.add(name);
    // A compound (`Object.assign(Root, { Part })`) carries its parts as
    // properties of the exported value's type.
    const type = checker.getTypeOfSymbolAtLocation(symbol, source);
    for (const part of type.getProperties()) {
      if (isComponentName(part.getName())) kit.add(part.getName());
    }
  }
  return { designSystem, kit };
}

/** The `// uncatalogued: <why>` marker at the top of a module: `null` when absent, the reason (maybe empty) otherwise. */
export function uncataloguedReason(source) {
  const head = source.split('\n').slice(0, 10).join('\n');
  const match = head.match(MARKER);
  return match ? match[1].trim() : null;
}

/**
 * The drift between the catalog and the exports.
 * `docs` is `[{ file, text }]`; `designSystem` a `Map<name, module file>`;
 * `kit` a `Set` of public kit names; `readModule(file)` the module's source.
 */
export function catalogProblems({ docs, designSystem, kit, readModule, root = '' }) {
  const problems = [];
  const rows = docs.flatMap(({ file, text }) =>
    useColumnNames(text).map((row) => ({ ...row, file })),
  );

  for (const { file, line, name } of rows) {
    if (designSystem.has(name) || kit.has(name)) continue;
    problems.push(
      `${file}:${line}: \`${name}\` is not a public export of @oppenheimer/design-system-web or @oppenheimer/frontend-web — rename the row or drop it with the component`,
    );
  }

  const modules = new Map();
  for (const [name, file] of designSystem) {
    if (isComponentName(name)) modules.set(file, [...(modules.get(file) ?? []), name]);
  }
  const named = new Set(rows.map(({ name }) => designSystem.get(name)).filter(Boolean));
  for (const [file, components] of modules) {
    const where = root ? relative(root, file) : file;
    const reason = uncataloguedReason(readModule(file));
    if (named.has(file)) {
      if (reason !== null)
        problems.push(
          `${where}: has a catalog row, so its \`// uncatalogued:\` marker is stale — remove it`,
        );
      continue;
    }
    if (reason === null) {
      problems.push(
        `${where} (${components.join(', ')}): exported by the design system but no catalog row's Use column names it — add a row to .agents/reference/frontend-ui-catalog.md, or open the module with \`// uncatalogued: <why>\``,
      );
    } else if (reason === '') {
      problems.push(`${where}: \`// uncatalogued:\` needs a reason after the colon`);
    }
  }
  return problems;
}

/** The check against a checkout; empty when the catalog or the design system is not there. */
export function repositoryCatalogProblems(root) {
  const designSystemIndex = join(root, DESIGN_SYSTEM_INDEX);
  if (
    !CATALOG_FILES.every((file) => existsSync(join(root, file))) ||
    !existsSync(designSystemIndex)
  )
    return [];
  const docs = CATALOG_FILES.map((file) => ({
    file,
    text: readFileSync(join(root, file), 'utf8'),
  }));
  const { designSystem, kit } = publicExports(designSystemIndex, join(root, KIT_INDEX));
  return catalogProblems({
    docs,
    designSystem,
    kit,
    readModule: (file) => readFileSync(file, 'utf8'),
    root,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const problems = repositoryCatalogProblems(root);
  if (problems.length > 0) {
    console.error(`UI catalog: ${problems.length} problem${problems.length === 1 ? '' : 's'}\n`);
    for (const problem of problems) console.error(`  ✖ ${problem}`);
    console.error('\nSee .agents/rules/frontend-ui.md, "Reach for the design system"');
    process.exit(1);
  }
  console.log(
    'UI catalog: every row names a public export, every component has a row or a reason.',
  );
}
