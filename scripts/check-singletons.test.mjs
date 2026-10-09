/**
 * The singleton check against lockfiles built for the purpose. The first
 * fixture is the #274 incident in miniature: the app compiles with
 * TypeScript 7, `packages/frontend/core` with 6, `i18next` takes TypeScript
 * as a peer, so pnpm resolves `i18next` and `react-i18next` twice.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findDuplicateSingletons, parseLockfile } from './check-singletons.mjs';

const SINGLETONS = ['react', 'react-dom', '@tanstack/react-query', 'i18next', 'react-i18next'];

const i18n = (ts) => `i18next@26.4.2(typescript@${ts})`;
const reactI18n = (ts) =>
  `react-i18next@17.0.14(${i18n(ts)})(react-dom@19.2.3(react@19.2.3))(react@19.2.3)(typescript@${ts})`;
const suffix = (key) => key.slice(key.indexOf('@', 1) + 1);

/** A v9 lockfile where `apps/web` uses `appTs` and `packages/frontend/core` uses `coreTs`. */
function lockfile({ appTs = '7.0.2', coreTs = '7.0.2', extraImporters = '' } = {}) {
  const variants = [...new Set([appTs, coreTs])];
  return `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

overrides:
  react: 19.2.3

importers:

  .:
    devDependencies:
      typescript:
        specifier: ^6.0.3
        version: 6.0.3

  apps/web:
    dependencies:
      '@oppenheimer/frontend-core':
        specifier: workspace:*
        version: link:../../packages/frontend/core
      '@tanstack/react-query':
        specifier: 5.102.8
        version: 5.102.8(react@19.2.3)
      i18next:
        specifier: ^26.4.2
        version: ${suffix(i18n(appTs))}
      react:
        specifier: 19.2.3
        version: 19.2.3
      react-i18next:
        specifier: ^17.0.14
        version: ${suffix(reactI18n(appTs))}
    devDependencies:
      typescript:
        specifier: ^7.0.2
        version: ${appTs}

  packages/frontend/core:
    dependencies:
      i18next:
        specifier: ^26.4.2
        version: ${suffix(i18n(coreTs))}
      react-i18next:
        specifier: ^17.0.14
        version: ${suffix(reactI18n(coreTs))}
    devDependencies:
      typescript:
        specifier: ^7.0.2
        version: ${coreTs}
${extraImporters}
packages:

  i18next@26.4.2:
    resolution: {integrity: sha512-x}

snapshots:

  '@tanstack/react-query@5.102.8(react@19.2.3)':
    dependencies:
      '@tanstack/query-core': 5.102.8
      react: 19.2.3

  '@tanstack/query-core@5.102.8': {}
${variants
  .map(
    (ts) => `
  ${i18n(ts)}:
    optionalDependencies:
      typescript: ${ts}

  ${reactI18n(ts)}:
    dependencies:
      i18next: ${suffix(i18n(ts))}
      react: 19.2.3
    optionalDependencies:
      react-dom: 19.2.3(react@19.2.3)
      typescript: ${ts}

  typescript@${ts}: {}
`,
  )
  .join('')}
  react-dom@19.2.3(react@19.2.3):
    dependencies:
      react: 19.2.3
      scheduler: 0.27.0

  react@19.2.3: {}

  scheduler@0.27.0: {}
`;
}

test('the TS6/TS7 split behind #274 fails, naming both copies and who pulls each', () => {
  const duplicates = findDuplicateSingletons({
    lockfile: lockfile({ appTs: '7.0.2', coreTs: '6.0.3' }),
    importers: ['apps/web'],
    singletons: SINGLETONS,
  });
  assert.deepEqual(duplicates.map((d) => d.name).sort(), ['i18next', 'react-i18next']);
  const reactI18next = duplicates.find((d) => d.name === 'react-i18next');
  assert.deepEqual(reactI18next.variants.map((v) => v.key).sort(), [
    reactI18n('6.0.3'),
    reactI18n('7.0.2'),
  ]);
  const fromCore = reactI18next.variants.find((v) => v.key === reactI18n('6.0.3'));
  assert.deepEqual(fromCore.via, ['apps/web', 'packages/frontend/core', reactI18n('6.0.3')]);
});

test('the same packages on one TypeScript resolve once and pass', () => {
  const duplicates = findDuplicateSingletons({
    lockfile: lockfile(),
    importers: ['apps/web'],
    singletons: SINGLETONS,
  });
  assert.deepEqual(duplicates, []);
});

test('a split in a project the app never reaches does not fail the app', () => {
  const extra = `
  apps/other:
    dependencies:
      i18next:
        specifier: ^26.4.2
        version: 26.4.2(typescript@6.0.3)
`;
  const text = lockfile({ extraImporters: extra }).replace(
    '\n  react-dom@19.2.3(react@19.2.3):',
    `\n  ${i18n('6.0.3')}: {}\n\n  react-dom@19.2.3(react@19.2.3):`,
  );
  assert.deepEqual(
    findDuplicateSingletons({ lockfile: text, importers: ['apps/web'], singletons: SINGLETONS }),
    [],
  );
  assert.deepEqual(
    findDuplicateSingletons({
      lockfile: text,
      importers: ['apps/web', 'apps/other'],
      singletons: SINGLETONS,
    }).map((d) => d.name),
    ['i18next'],
  );
});

test('a package off the list may resolve twice', () => {
  const duplicates = findDuplicateSingletons({
    lockfile: lockfile({ appTs: '7.0.2', coreTs: '6.0.3' }),
    importers: ['apps/web'],
    singletons: ['react', 'react-dom'],
  });
  assert.deepEqual(duplicates, []);
});

test('a singleton reached only through another snapshot is still counted', () => {
  // react-dom is no importer's direct dependency here: only react-i18next's
  // optional peer reaches it. Give it a second variant and it must fail.
  const text = lockfile()
    .replace(
      'optionalDependencies:\n      react-dom: 19.2.3(react@19.2.3)',
      'optionalDependencies:\n      react-dom: 19.2.4(react@19.2.3)',
    )
    .replace(
      '\n  react@19.2.3: {}',
      '\n  react-dom@19.2.4(react@19.2.3):\n    dependencies:\n      react: 19.2.3\n\n  react@19.2.3: {}',
    )
    .replace(
      '      react:\n        specifier: 19.2.3\n        version: 19.2.3\n',
      '      react:\n        specifier: 19.2.3\n        version: 19.2.3\n      react-dom:\n        specifier: 19.2.3\n        version: 19.2.3(react@19.2.3)\n',
    );
  const duplicates = findDuplicateSingletons({
    lockfile: text,
    importers: ['apps/web'],
    singletons: SINGLETONS,
  });
  assert.deepEqual(
    duplicates.map((d) => [d.name, d.variants.length]),
    [['react-dom', 2]],
  );
});

test('an importer missing from the lockfile is an error, not a silent pass', () => {
  assert.throws(
    () =>
      findDuplicateSingletons({
        lockfile: lockfile(),
        importers: ['apps/renamed'],
        singletons: SINGLETONS,
      }),
    /importer "apps\/renamed" is not in pnpm-lock.yaml/,
  );
});

test('the parser reads quoted scoped keys, empty snapshots and aliases', () => {
  const { importers, snapshots } = parseLockfile(`lockfileVersion: '9.0'

importers:

  .:
    dependencies:
      '@scope/pkg':
        specifier: ^1.0.0
        version: 1.0.0(react@19.2.3)

snapshots:

  '@scope/pkg@1.0.0(react@19.2.3)':
    dependencies:
      string-width-cjs: string-width@4.2.3
    devDependencies:
      ignored: 1.0.0

  string-width@4.2.3: {}
`);
  assert.deepEqual(importers.get('.'), [{ name: '@scope/pkg', version: '1.0.0(react@19.2.3)' }]);
  assert.deepEqual(snapshots.get('@scope/pkg@1.0.0(react@19.2.3)'), [
    { name: 'string-width-cjs', version: 'string-width@4.2.3' },
  ]);
  assert.deepEqual(snapshots.get('string-width@4.2.3'), []);
});
