// The screenshot guard's policy: which paths count as a visual change, and
// when a branch is held for its screenshots. The last block runs the hook as
// Claude Code does, on a throwaway repository with an `origin/main`.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { isVisual } from './screenshot-guard.mjs';

const HOOK = fileURLToPath(new URL('./screenshot-guard.mjs', import.meta.url));

// oppenheimer:begin web
describe('isVisual', () => {
  for (const path of [
    'apps/web/src/features/hosts/sections/host-list.tsx',
    'apps/web/src/routes/_authenticated/sessions.tsx',
    'apps/web/src/styles.css',
    'apps/web/public/theme-init.js',
    'apps/web/index.html',
    'packages/frontend/web/src/shell/components/sidebar.tsx',
    'packages/frontend/design-system/web/src/components/badge.tsx',
    'packages/frontend/design-system/web/src/styles/globals.css',
    'packages/translations/en/index.json',
  ])
    it(`counts ${path}`, () => assert.equal(isVisual(path), true));

  for (const path of [
    'apps/web/src/features/hosts/__tests__/host-list.spec.tsx',
    'apps/web/src/lib/format.test.ts',
    'packages/frontend/design-system/web/src/components/badge.stories.tsx',
    'apps/web/src/features/README.md',
    'apps/web/vite.config.ts',
    'apps/api/src/hosts/hosts.controller.ts',
    'packages/frontend/consumer/src/modules/hosts/hooks/use-hosts.ts',
    'packages/shared/src/schemas/hosts.schema.ts',
    'docs/screens.md',
  ])
    it(`skips ${path}`, () => assert.equal(isVisual(path), false));
});

describe('the hook', () => {
  const root = mkdtempSync(join(tmpdir(), 'screenshot-guard-'));
  after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
      cwd: root,
      encoding: 'utf8',
    });
  const write = (path, body = 'x', at) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
    if (at) utimesSync(join(root, path), at, at);
  };
  const stop = (input = {}) => {
    const result = spawnSync('node', [HOOK], {
      cwd: root,
      input: JSON.stringify({ cwd: root, ...input }),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout ? JSON.parse(result.stdout) : null;
  };

  git('init', '-q', '-b', 'main');
  write('README.md');
  git('add', 'README.md');
  git('commit', '-q', '-m', 'init');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  git('checkout', '-q', '-b', 'feature');

  it('lets a branch with no visual change stop', () => {
    write('apps/api/src/x.ts');
    git('add', 'apps/api/src/x.ts');
    git('commit', '-q', '-m', 'api');
    assert.equal(stop(), null);
  });

  it('holds an uncommitted visual change', () => {
    write('apps/web/src/features/hosts/sections/list.tsx');
    const held = stop();
    assert.equal(held?.decision, 'block');
    assert.match(held.reason, /apps\/web\/src\/features\/hosts\/sections\/list\.tsx/);
  });

  it('lets the second stop through', () => {
    assert.equal(stop({ stop_hook_active: true }), null);
  });

  it('holds a committed one too', () => {
    git('add', 'apps/web/src/features/hosts/sections/list.tsx');
    git('commit', '-q', '-m', 'web');
    assert.equal(stop()?.decision, 'block');
  });

  it('is answered by screenshots newer than the change', () => {
    write('.screenshots/manifest.json', '{}', new Date(Date.now() + 5_000));
    assert.equal(stop(), null);
  });

  it('is not staled by committing after the screenshots', () => {
    git('commit', '-q', '--allow-empty', '-m', 'later commit');
    git('commit', '-q', '-am', 'nothing new', '--allow-empty');
    assert.equal(stop(), null);
  });

  it('holds again once the change moves past them', () => {
    write('.screenshots/manifest.json', '{}', new Date(Date.now() - 60_000));
    write('apps/web/src/features/hosts/sections/list.tsx', 'y', new Date());
    assert.equal(stop()?.decision, 'block');
  });

  it('is answered by a not-visual note newer than the change', () => {
    write('.screenshots/not-visual.md', 'renamed a prop', new Date(Date.now() + 5_000));
    assert.equal(stop(), null);
  });

  it('compares against main when origin/main is older than it', () => {
    git('checkout', '-q', '-f', 'main');
    git('clean', '-fdq');
    write('apps/web/src/on-main.tsx', 'main', new Date(Date.now() + 60_000));
    git('add', 'apps/web/src/on-main.tsx');
    git('commit', '-q', '-m', 'main moved on');
    git('checkout', '-q', '-b', 'fresh');
    rmSync(join(root, '.screenshots'), { recursive: true, force: true });
    assert.equal(stop(), null);
  });

  it('stays out of a repository with no main', () => {
    git('update-ref', '-d', 'refs/remotes/origin/main');
    git('branch', '-q', '-m', 'main', 'trunk');
    assert.equal(stop(), null);
  });
});
// oppenheimer:end web
