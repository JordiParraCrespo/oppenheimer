/**
 * The singleton check against lockfiles built for the purpose. The split
 * fixture is a peer-suffix split in miniature: the app compiles with
 * TypeScript 7, `packages/frontend/core` with 6, `i18next` takes TypeScript
 * as a peer, so pnpm resolves `i18next` and `react-i18next` twice.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseLockfile, resolveSingletons } from './check-singletons.mjs';

const SINGLETONS = ['react', 'react-dom', '@tanstack/react-query', 'i18next', 'react-i18next'];

const i18n = (ts) => `i18next@26.4.2(typescript@${ts})`;
const reactI18n = (ts) =>
  `react-i18next@17.0.14(${i18n(ts)})(react-dom@19.2.3(react@19.2.3))(react@19.2.3)(typescript@${ts})`;
const suffix = (key) => key.slice(key.indexOf('@', 1) + 1);

/**
 * A v9 lockfile where `apps/web` uses `appTs`, `packages/frontend/core` uses
 * `coreTs`, and react-i18next's optional react-dom peer resolves to
 * `peerReactDom` while the app itself depends on `appReactDom` (none: no
 * direct dependency).
 */
function lockfile({
  appTs = '7.0.2',
  coreTs = '7.0.2',
  peerReactDom = '19.2.3',
  appReactDom,
  extraImporters = '',
  extraSnapshots = '',
} = {}) {
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
${
  appReactDom
    ? `      react-dom:
        specifier: 19.2.3
        version: ${appReactDom}(react@19.2.3)
`
    : ''
}      react-i18next:
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
      react-dom: ${peerReactDom}(react@19.2.3)
      typescript: ${ts}

  typescript@${ts}: {}
`,
  )
  .join('')}
${[...new Set([peerReactDom, appReactDom ?? peerReactDom])]
  .map(
    (version) => `
  react-dom@${version}(react@19.2.3):
    dependencies:
      react: 19.2.3
      scheduler: 0.27.0
`,
  )
  .join('')}${extraSnapshots}
  react@19.2.3: {}

  scheduler@0.27.0: {}
`;
}

const check = (options, importer = 'apps/web', singletons = SINGLETONS) =>
  resolveSingletons({ lockfile: lockfile(options), importer, singletons });
const counts = (result) => Object.fromEntries(result.map((r) => [r.name, r.variants.length]));

test('a peer-suffix split fails, naming both copies and who pulls each', () => {
  const result = check({ appTs: '7.0.2', coreTs: '6.0.3' });
  assert.deepEqual(counts(result), {
    react: 1,
    'react-dom': 1,
    '@tanstack/react-query': 1,
    i18next: 2,
    'react-i18next': 2,
  });
  const reactI18next = result.find((r) => r.name === 'react-i18next');
  const fromCore = reactI18next.variants.find((v) => v.key === reactI18n('6.0.3'));
  assert.deepEqual(fromCore.via, ['apps/web', 'packages/frontend/core', reactI18n('6.0.3')]);
});

test('aligned packages resolve to exactly one snapshot each', () => {
  const result = check();
  assert.deepEqual(
    result.map((r) => [r.name, r.variants.map((v) => v.key)]),
    [
      ['react', ['react@19.2.3']],
      ['react-dom', ['react-dom@19.2.3(react@19.2.3)']],
      ['@tanstack/react-query', ['@tanstack/react-query@5.102.8(react@19.2.3)']],
      ['i18next', [i18n('7.0.2')]],
      ['react-i18next', [reactI18n('7.0.2')]],
    ],
  );
});

test('a listed name the closure never reaches comes back with no snapshot, which fails', () => {
  const result = check({}, 'apps/web', [...SINGLETONS, '@tanstack/react-router']);
  assert.deepEqual(result.find((r) => r.name === '@tanstack/react-router').variants, []);
});

test('a split in a project the app never reaches does not count for the app', () => {
  const options = {
    extraImporters: `
  apps/other:
    dependencies:
      i18next:
        specifier: ^26.4.2
        version: 26.4.2(typescript@6.0.3)
`,
    extraSnapshots: `
  ${i18n('6.0.3')}: {}
`,
  };
  assert.equal(counts(check(options)).i18next, 1);
  assert.equal(counts(check(options, 'apps/other', ['i18next'])).i18next, 1);
});

test('a package off the list may resolve twice', () => {
  assert.deepEqual(counts(check({ appTs: '7.0.2', coreTs: '6.0.3' }, 'apps/web', ['react'])), {
    react: 1,
  });
});

test('a singleton reached only through another snapshot is still counted', () => {
  // react-i18next's optional peer is the only way to react-dom@19.2.4.
  const result = check({ peerReactDom: '19.2.4', appReactDom: '19.2.3' });
  assert.equal(counts(result)['react-dom'], 2);
});

test('an importer missing from the lockfile is an error, not a silent pass', () => {
  assert.throws(
    () => check({}, 'apps/renamed'),
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

  packages/empty: {}

snapshots:

  '@scope/pkg@1.0.0(react@19.2.3)':
    dependencies:
      string-width-cjs: string-width@4.2.3
    optional: true
    transitivePeerDependencies:
      - '@scope/peer'

  string-width@4.2.3: {}
`);
  assert.deepEqual(importers.get('.'), [{ name: '@scope/pkg', version: '1.0.0(react@19.2.3)' }]);
  assert.deepEqual(importers.get('packages/empty'), []);
  assert.deepEqual(snapshots.get('@scope/pkg@1.0.0(react@19.2.3)'), [
    { name: 'string-width-cjs', version: 'string-width@4.2.3' },
  ]);
  assert.deepEqual(snapshots.get('string-width@4.2.3'), []);
});

test('a line the parser does not know throws instead of being skipped', () => {
  const shapes = [
    // a field it does not read
    '  react@19.2.3:\n    peerDependencies:\n      typescript: 7.0.2\n',
    // a block scalar
    '  react@19.2.3:\n    dependencies:\n      scheduler: |\n        0.27.0\n',
    // a double-quoted value
    '  react@19.2.3:\n    dependencies:\n      scheduler: "0.27.0"\n',
    // a deeper indent
    '  react@19.2.3:\n    dependencies:\n        scheduler: 0.27.0\n',
  ];
  for (const shape of shapes) {
    assert.throws(() => parseLockfile(`snapshots:\n\n${shape}`), /pnpm-lock\.yaml:\d+:/, shape);
  }
});
