// The architecture check's decisions (`arch-check.mjs`): which packages it
// finds, what counts as their change, when a package that passed is cruised
// again, and when depcruise can run without turbo building first. The hook
// end to end is in `shell-hooks.test.mjs`.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import {
  changedPaths,
  depsBuilt,
  discoverPackages,
  fingerprint,
  touches,
} from './arch-check.mjs';

function repo() {
  const root = mkdtempSync(join(tmpdir(), 'arch-check-unit-'));
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
      cwd: root,
      encoding: 'utf8',
    });
  const write = (path, body = 'x') => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  };
  git('init', '-q', '-b', 'main');
  return { root, git, write };
}

describe('discoverPackages', () => {
  const { root, git, write } = repo();
  after(() => rmSync(root, { recursive: true, force: true }));
  write('apps/api/.dependency-cruiser.cjs', 'module.exports = {}');
  write(
    'apps/console/.dependency-cruiser.cjs',
    "module.exports = require('@oppenheimer/tsconfig/depcruise/frontend-app.cjs')({})",
  );
  write('node_modules/x/.dependency-cruiser.cjs', '');
  write('.gitignore', 'node_modules\n');
  git('add', '.gitignore', 'apps/api');

  it('finds every config, tracked or new, and skips ignored ones', () => {
    assert.deepEqual(
      discoverPackages(root).map((pkg) => pkg.dir),
      ['apps/api', 'apps/console'],
    );
  });

  it('watches the source and the config, and the shared rules a config loads', () => {
    const [api, app] = discoverPackages(root);
    assert.deepEqual(api, {
      dir: 'apps/api',
      watch: ['apps/api/src', 'apps/api/.dependency-cruiser.cjs'],
      frontend: false,
    });
    assert.deepEqual(app.watch, [
      'apps/console/src',
      'apps/console/.dependency-cruiser.cjs',
      'packages/tsconfig/depcruise',
    ]);
    assert.equal(app.frontend, true);
  });
});

describe('changedPaths and touches', () => {
  const { root, git, write } = repo();
  after(() => rmSync(root, { recursive: true, force: true }));
  write('a/src/old.ts');
  write('b/keep.ts');
  git('add', 'a', 'b');
  git('commit', '-q', '-m', 'init');

  it('names both sides of a rename, and untracked files one by one', () => {
    git('mv', 'a/src/old.ts', 'b/new.ts');
    write('c/deep/new.ts');
    assert.deepEqual(changedPaths(root).sort(), ['a/src/old.ts', 'b/new.ts', 'c/deep/new.ts']);
  });

  it('matches a watched path or anything under it, not a sibling with its prefix', () => {
    assert.equal(touches(['a/src/x.ts'], ['a/src']), true);
    assert.equal(touches(['a/src'], ['a/src']), true);
    assert.equal(touches(['a/srcs/x.ts'], ['a/src']), false);
  });
});

describe('fingerprint', () => {
  const { root, git, write } = repo();
  after(() => rmSync(root, { recursive: true, force: true }));
  write('pkg/src/index.ts');
  git('add', 'pkg');
  git('commit', '-q', '-m', 'init');
  const now = () => fingerprint(root, ['pkg/src']);

  it('stays the same while nothing under the watch changes', () => {
    const before = now();
    write('elsewhere.ts');
    assert.equal(now(), before);
  });

  it('changes with an edit', () => {
    const before = now();
    write('pkg/src/index.ts', 'y');
    assert.notEqual(now(), before);
  });

  it('changes when an untracked file moves, though its content does not', () => {
    write('pkg/src/adapters/a.ts', 'same');
    const before = now();
    mkdirSync(join(root, 'pkg/src/domain'));
    renameSync(join(root, 'pkg/src/adapters/a.ts'), join(root, 'pkg/src/domain/a.ts'));
    assert.notEqual(now(), before);
  });
});

describe('depsBuilt', () => {
  const root = mkdtempSync(join(tmpdir(), 'arch-check-deps-'));
  after(() => rmSync(root, { recursive: true, force: true }));
  const pkg = (dir, json) => {
    mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(join(root, dir, 'package.json'), JSON.stringify(json));
  };
  const link = (from, name, to) => {
    mkdirSync(join(root, from, 'node_modules', dirname(name)), { recursive: true });
    symlinkSync(join(root, to), join(root, from, 'node_modules', name));
  };
  const built = { scripts: { build: 'tsc' }, exports: { '.': './dist/index.js' } };
  pkg('app', { dependencies: { '@x/lib': 'workspace:*', react: '^19' } });
  pkg('lib', { ...built, dependencies: { '@x/base': 'workspace:*' } });
  pkg('base', built);
  pkg('config', { exports: { '.': './index.cjs' } });
  link('app', '@x/lib', 'lib');
  link('lib', '@x/base', 'base');

  it('is false while a package reached through another has no dist yet', () => {
    mkdirSync(join(root, 'lib/dist'));
    assert.equal(depsBuilt(join(root, 'app')), false);
  });

  it('is true once every package that builds has its dist', () => {
    mkdirSync(join(root, 'base/dist'));
    assert.equal(depsBuilt(join(root, 'app')), true);
  });

  it('asks nothing of a package that does not build, nor of the package itself', () => {
    pkg('app', { ...built, dependencies: { '@x/config': 'workspace:*' } });
    link('app', '@x/config', 'config');
    assert.equal(depsBuilt(join(root, 'app')), true);
  });
});
