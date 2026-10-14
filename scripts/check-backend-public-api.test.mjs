/**
 * The public-API check, tested against packages built for the purpose.
 *
 * Running it over the repository only says the surfaces are clean today; it
 * cannot show that a leak would be caught. These fixtures are real programs
 * with their own `node_modules`, so what is checked is what `tsc` puts in a
 * `.d.ts`: a private field's type is not emitted, a constructor parameter's
 * is, and a package that does not compile is not judged at all.
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { analyze, backendPackages, judge, packageOf } from './check-backend-public-api.mjs';

const roots = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** Write a package from a {path: contents} map; returns its directory. */
function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'oppenheimer-public-api-'));
  roots.push(dir);
  const all = {
    'package.json': JSON.stringify({ name: '@oppenheimer/backend-fixture' }),
    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'CommonJS',
        moduleResolution: 'node',
        ignoreDeprecations: '6.0',
        strict: true,
        skipLibCheck: true,
        types: [],
        rootDir: './src',
        outDir: './dist',
      },
      include: ['src'],
    }),
    // Stand-ins for the libraries the sources import, so the programs compile.
    'node_modules/ioredis/package.json': JSON.stringify({ name: 'ioredis', types: 'index.d.ts' }),
    'node_modules/ioredis/index.d.ts': 'export declare class Redis { get(key: string): string; }',
    'node_modules/@types/fake-env/index.d.ts': 'declare const FAKE_ENV: string;',
    ...files,
  };
  for (const [path, contents] of Object.entries(all)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), contents);
  }
  return dir;
}

const modules = (imports) => [...new Set(imports.map(({ module }) => module))].sort();

test('packageOf keeps the scope and drops the subpath', () => {
  assert.equal(packageOf('@nestjs/common'), '@nestjs/common');
  assert.equal(packageOf('@acme/driver-kit/dist/x'), '@acme/driver-kit');
  assert.equal(packageOf('ioredis/built/Redis'), 'ioredis');
  assert.equal(packageOf('node:fs'), 'node');
});

test('a driver library in an exported signature is on the surface, at its real source', () => {
  const dir = fixture({
    'src/index.ts': "export { Driver } from './drivers/redis.driver';",
    'src/drivers/redis.driver.ts': [
      "import type { Redis } from 'ioredis';",
      'export class Driver {',
      '  constructor(readonly client: Redis) {}',
      '}',
    ].join('\n'),
  });
  const { diagnostics, imports } = analyze(dir);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(modules(imports), ['ioredis']);
  const refused = judge('@oppenheimer/backend-fixture', imports, {});
  assert.deepEqual(
    refused.map(({ file, module }) => [file, module]),
    [[join('src', 'drivers', 'redis.driver.ts'), 'ioredis']],
  );
});

test('an import() type the emitter synthesises is read, in the file that emits it', () => {
  const dir = fixture({
    'src/index.ts': "import { create } from './factory';\nexport const client = create();",
    'src/factory.ts': "import { Redis } from 'ioredis';\nexport const create = () => new Redis();",
  });
  const { diagnostics, imports } = analyze(dir);
  assert.deepEqual(diagnostics, []);
  // index.ts imports nothing from ioredis, but its declaration names
  // `import("ioredis").Redis`; factory.d.ts is not reached from it.
  assert.deepEqual(
    imports.map(({ file, specifier }) => [file, specifier]),
    [[join('src', 'index.ts'), 'ioredis']],
  );
});

test('a type reference directive the declaration keeps is read', () => {
  // Since TS 5.5 declaration emit keeps only a directive marked preserve.
  const dir = fixture({
    'src/index.ts':
      '/// <reference types="fake-env" preserve="true" />\nexport const env: string = FAKE_ENV;',
  });
  const { diagnostics, imports } = analyze(dir);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(modules(imports), ['fake-env']);
});

test('a private field keeps its library off the surface', () => {
  const dir = fixture({
    'src/index.ts': [
      "import type { Redis } from 'ioredis';",
      'export class Driver {',
      '  private client?: Redis;',
      '  get(): string { return String(this.client); }',
      '}',
    ].join('\n'),
  });
  assert.deepEqual(analyze(dir), { diagnostics: [], imports: [] });
});

test('a file the entry does not reach is not on the surface', () => {
  const dir = fixture({
    'src/index.ts': 'export const x = 1;',
    'src/internal.ts': "import type { Redis } from 'ioredis';\nexport type R = Redis;",
  });
  assert.deepEqual(analyze(dir), { diagnostics: [], imports: [] });
});

test('a package that does not typecheck fails closed with its diagnostics', () => {
  const dir = fixture({
    'src/index.ts': [
      "import type { Redis } from 'ioredis';",
      'export class Driver {',
      '  constructor(readonly client: Redis) {}',
      '}',
      'export const n: number = "not a number";',
    ].join('\n'),
  });
  const { diagnostics, imports } = analyze(dir);
  assert.deepEqual(imports, []);
  assert.equal(diagnostics.length, 1);
  assert.match(diagnostics[0], /src\/index\.ts.*TS2322/);
});

test('an unresolved module fails closed rather than passing unjudged', () => {
  const dir = fixture({
    'src/index.ts': "import type { Queue } from 'bullmq';\nexport type Q = Queue;",
  });
  const { diagnostics, imports } = analyze(dir);
  assert.deepEqual(imports, []);
  assert.match(diagnostics.join('\n'), /TS2307/);
});

test('judge allows what * and the package list name, and nothing else', () => {
  const imports = ['@nestjs/common', '@oppenheimer/shared', 'node', 'fs', 'zod', 'bullmq'].map(
    (module) => ({ file: 'src/index.ts', specifier: module, module }),
  );
  const refused = judge('@oppenheimer/backend-x', imports, {
    '*': ['@nestjs/common', '@oppenheimer/*', 'node', 'fs'],
    '@oppenheimer/backend-x': ['zod'],
  });
  assert.deepEqual(
    refused.map(({ module }) => module),
    ['bullmq'],
  );
  // The real list: Node builtins and the workspace come with '*'.
  assert.deepEqual(
    judge('@oppenheimer/backend-cache', imports).map(({ module }) => module),
    ['zod', 'bullmq'],
  );
});

test('every backend package in the repository is found', () => {
  const names = backendPackages().map(({ name }) => name);
  assert.ok(names.includes('@oppenheimer/backend-cache'));
  assert.ok(names.every((name) => name.startsWith('@oppenheimer/backend-')));
});
