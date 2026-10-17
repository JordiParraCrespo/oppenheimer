#!/usr/bin/env node
/**
 * No driver library in a backend package's public API.
 *
 * A `packages/backend/*` package is the seam between the API and a library it
 * happens to run on: `CacheService` is the contract, ioredis is how one driver
 * keeps it. Once a signature the package exports names an ioredis or BullMQ
 * type, every caller is written against that library too, and swapping the
 * driver is a change across the API instead of inside the package. So the
 * surface a package exports may name what `ALLOWED` lists — the framework,
 * the workspace, Node, and the few libraries that are the point of that
 * package — and nothing else.
 *
 * "The surface" is the declarations `tsc` would emit for the package, from
 * `src/index.ts` and every package file those declarations reach. A private
 * field's type is not emitted, so a driver may hold an ioredis client; a
 * constructor parameter, a return type or a re-export is emitted, and is
 * checked. The program is built from the package's own `tsconfig.json`, in
 * memory, so the check needs no build and sees the working tree as it is.
 *
 * The module names are read off the declaration ASTs inside the emit, by an
 * `afterDeclarations` transformer: that is exactly what the `.d.ts` will
 * name, including the `import("x")` types the emitter synthesises for
 * inferred types, which walking the checker's exported symbols would have to
 * re-derive. The transformer sees each declaration file with its original
 * source, which is the path a violation is reported at.
 *
 * It fails closed: a package whose program has diagnostics, or whose emit is
 * skipped, fails with those diagnostics rather than being judged on a
 * partial surface.
 *
 *   node scripts/check-backend-public-api.mjs           check every package
 *   node scripts/check-backend-public-api.mjs --list    print every library each surface names
 *
 * Run: pnpm check:public-api
 */
import { existsSync, readdirSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND = join(ROOT, 'packages/backend');

/**
 * What a package's surface may name, keyed by package; `'*'` is what every
 * package may name. A library goes under a package only when it is the point
 * of the package, not the driver behind it; the pluggable packages (email,
 * llm, queue, storage) have no entry. An entry ending in `/*` matches the
 * whole scope.
 */
export const ALLOWED = {
  '*': [
    // The framework the packages plug into: a module returns a
    // `DynamicModule`, an interceptor an `Observable`.
    '@nestjs/common',
    '@nestjs/core',
    '@nestjs/config',
    'rxjs',
    // The workspace, held to its own rules.
    '@oppenheimer/*',
    // Node itself: `node:*` specifiers and `/// <reference types="node" />`
    // both come out as `node`, bare builtins as their own name.
    'node',
    ...builtinModules,
  ],
  // Row scoping is applied to the caller's TypeORM query builders, which is
  // why `typeorm` is a peer dependency of the package.
  '@oppenheimer/backend-authz': ['typeorm'],
  // The cache is handed the app's Redis client and does not own it (see
  // `RedisCacheService`: the connection is shared with the queue and sessions),
  // so the client's type is part of `CacheModuleOptions` by design.
  '@oppenheimer/backend-cache': ['ioredis'],
  // The request pipeline itself: the nestjs-pino/pino-http options the logging
  // module assembles for the app; `@nestjs/swagger` is the framework's OpenAPI
  // half (`ApiPropertyOptions` on the nullable-enum decorator); the metrics
  // module re-exports prometheus's Counter, Gauge, Histogram and Registry
  // types so the API's modules can declare their own instruments.
  '@oppenheimer/backend-core': [
    '@nestjs/swagger',
    '@prometheus-io/client',
    'nestjs-pino',
    'pino-http',
  ],
  // The outbox is a TypeORM table written in the caller's transaction, and
  // oxide.ts's `Option` is the repository port's vocabulary.
  '@oppenheimer/backend-ddd': ['typeorm', 'oxide.ts'],
};

/** `@scope/name/sub` → `@scope/name`, `name/sub` → `name`, `node:fs` → `node`. */
export function packageOf(specifier) {
  if (specifier.startsWith('node:')) return 'node';
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/** Every bare module specifier one declaration SourceFile names. */
function specifiersIn(declaration) {
  const found = (declaration.typeReferenceDirectives ?? []).map((ref) => ref.fileName);
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      found.push(node.moduleSpecifier.text);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      found.push(node.argument.literal.text);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      found.push(node.moduleReference.expression.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(declaration);
  return found;
}

const formatHost = {
  getCanonicalFileName: (fileName) => fileName,
  getCurrentDirectory: () => ROOT,
  getNewLine: () => '\n',
};

/**
 * Build the package at `dir` from its own tsconfig and emit its declarations
 * in memory. Returns `{ diagnostics, imports }`: `diagnostics` is the program's
 * and the emit's, formatted, and when it is non-empty `imports` is empty —
 * a package that does not compile is not judged. Each import is
 * `{ file, specifier, module }`, `file` the source path (relative to `dir`)
 * whose declaration names it, reached from `src/index.ts`.
 */
export function analyze(dir) {
  const configPath = join(dir, 'tsconfig.json');
  const configErrors = [];
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {
      declaration: true,
      emitDeclarationOnly: true,
      declarationMap: false,
      sourceMap: false,
      noEmit: false,
    },
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: (d) => configErrors.push(d) },
  );
  const fail = (diagnostics) => ({
    diagnostics: diagnostics.map((d) => ts.formatDiagnostic(d, formatHost).trimEnd()),
    imports: [],
  });
  if (!parsed) return fail(configErrors);

  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
    projectReferences: parsed.projectReferences,
    configFileParsingDiagnostics: parsed.errors,
  });
  const pre = ts.getPreEmitDiagnostics(program);
  if (pre.length > 0) return fail(pre);

  // Source file name → the specifiers its declaration file names.
  const named = new Map();
  const collect = () => (node) => {
    for (const declaration of ts.isBundle(node) ? node.sourceFiles : [node]) {
      const source = ts.getOriginalNode(declaration);
      named.set(
        (ts.isSourceFile(source) ? source : declaration).fileName,
        specifiersIn(declaration),
      );
    }
    return node;
  };
  const emitted = program.emit(undefined, () => {}, undefined, true, {
    afterDeclarations: [collect],
  });
  if (emitted.emitSkipped || emitted.diagnostics.length > 0) {
    return fail(
      emitted.diagnostics.length > 0
        ? emitted.diagnostics
        : [{ category: ts.DiagnosticCategory.Error, code: 0, messageText: 'emit skipped' }],
    );
  }

  const entry = program.getSourceFile(join(dir, 'src/index.ts'))?.fileName;
  const imports = [];
  const seen = new Set();
  const queue = entry ? [entry] : [];
  while (queue.length > 0) {
    const file = queue.shift();
    if (seen.has(file) || !named.has(file)) continue;
    seen.add(file);
    for (const specifier of named.get(file)) {
      const target = ts.resolveModuleName(specifier, file, parsed.options, ts.sys).resolvedModule;
      if (target && !target.isExternalLibraryImport && named.has(target.resolvedFileName)) {
        queue.push(target.resolvedFileName);
      } else {
        imports.push({ file: relative(dir, file), specifier, module: packageOf(specifier) });
      }
    }
  }
  return { diagnostics: [], imports };
}

/** Whether `module` matches an `ALLOWED` entry: the name, or a `scope/*`. */
function matches(entry, module) {
  return entry.endsWith('/*') ? module.startsWith(entry.slice(0, -1)) : entry === module;
}

/** The imports of package `name` that nothing in `allowed` (its own list and `'*'`) allows. */
export function judge(name, imports, allowed = ALLOWED) {
  const list = [...(allowed['*'] ?? []), ...(allowed[name] ?? [])];
  return imports.filter(({ module }) => !list.some((entry) => matches(entry, module)));
}

/** Every backend package that has an entry to check: `{ name, dir }`. */
export function backendPackages(root = BACKEND) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name))
    .filter(
      (dir) => existsSync(join(dir, 'src/index.ts')) && existsSync(join(dir, 'tsconfig.json')),
    )
    .map((dir) => ({ name: readName(dir), dir }));
}

function readName(dir) {
  return JSON.parse(ts.sys.readFile(join(dir, 'package.json')) ?? '{}').name ?? dir;
}

// Run as a script; imported by the test suite without any of this firing.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const list = process.argv.includes('--list');
  const problems = [];
  const packages = backendPackages();
  for (const { name, dir } of packages) {
    const { diagnostics, imports } = analyze(dir);
    if (diagnostics.length > 0) {
      problems.push(
        `${name}: does not compile, so its surface cannot be judged:\n${diagnostics
          .map((d) => `      ${d.replaceAll('\n', '\n      ')}`)
          .join('\n')}`,
      );
      continue;
    }
    if (list) {
      const modules = [...new Set(imports.map(({ module }) => module))].sort();
      console.log(`${name}: ${modules.join(', ') || '(none)'}`);
      continue;
    }
    for (const { file, specifier } of judge(name, imports)) {
      problems.push(
        `${name}: ${relative(ROOT, join(dir, file))} exports a type from "${specifier}". ` +
          'Keep the driver library behind the abstract service, or add it to ALLOWED with its reason.',
      );
    }
  }
  if (problems.length > 0) {
    console.error(
      `Backend public API: ${problems.length} problem${problems.length === 1 ? '' : 's'}\n`,
    );
    for (const problem of problems) console.error(`  ✖ ${problem}`);
    console.error('\nSee .agents/rules/backend-packages.md');
    process.exit(1);
  }
  if (!list) console.log(`Backend public API: ${packages.length} packages name no driver library.`);
}
