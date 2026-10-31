// The screenshot guard's policy: which paths count as a visual change
// (`visual-change.mjs`), and when a branch is held for its screenshots. The
// last block runs the hook as Claude Code does, on a throwaway repository
// with an `origin/main`.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { isVisual, substance, visualChange } from './visual-change.mjs';

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
    'packages/translations/locales.ts',
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
    'packages/translations/scripts/assemble.mjs',
  ])
    it(`skips ${path}`, () => assert.equal(isVisual(path), false));
});

describe('substance, what the fingerprint hashes', () => {
  const tsx = (text) => substance('a.tsx', text);
  const view = 'export function A() {\n  return <p className="x">Hello world {n}</p>;\n}\n';

  it('ignores comments, quotes, semicolons and layout', () => {
    const reformatted =
      "/** The greeting. */\nexport function A() { return (\n    <p className='x'>\n      Hello world {n}\n    </p>\n  ) } // done";
    assert.equal(tsx(reformatted), tsx(view));
  });

  it('counts a change to the copy, a URL in JSX text included', () => {
    assert.notEqual(tsx(view.replace('Hello world', 'Hello there')), tsx(view));
    assert.notEqual(
      tsx('const a = <p>See https://x.dev/a</p>;'),
      tsx('const a = <p>See https://x.dev/b</p>;'),
    );
  });

  it('counts a change to a class name or a string', () => {
    assert.notEqual(tsx(view.replace('"x"', '"y"')), tsx(view));
  });

  it('reads a stylesheet without comments, keeping strings whole', () => {
    assert.equal(substance('a.css', '.a {\n  color: red; /* brand */\n}'), '.a { color: red; }');
    assert.notEqual(substance('a.css', '.a{content:"/* a */"}'), substance('a.css', '.a{content:"/* b */"}'));
  });

  it('reads JSON by value', () => {
    assert.equal(substance('a.json', '{\n  "a": "b"\n}\n'), substance('a.json', '{"a":"b"}'));
  });

  it('takes a script that does not parse as it is', () => {
    assert.equal(tsx('const = ;'), 'const = ;');
  });
});

describe('the hook', () => {
  const root = mkdtempSync(join(tmpdir(), 'screenshot-guard-'));
  after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
      cwd: root,
      encoding: 'utf8',
    });
  const write = (path, body = 'x') => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  };
  const stop = (input = {}, env = {}) => {
    const result = spawnSync('node', [HOOK], {
      cwd: root,
      env: { ...process.env, OPPENHEIMER_SCREENSHOT_GUARD: '', ...env },
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
  // The camera's presence is what turns the guard on.
  write('scripts/stack/screens.mjs', '');
  git('add', 'scripts/stack/screens.mjs');
  git('commit', '-q', '-m', 'camera');

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

  it('lets a run that turns the guard off stop (the audit eval)', () => {
    assert.equal(stop({}, { OPPENHEIMER_SCREENSHOT_GUARD: 'off' }), null);
  });

  it('holds a committed one too', () => {
    git('add', 'apps/web/src/features/hosts/sections/list.tsx');
    git('commit', '-q', '-m', 'web');
    assert.equal(stop()?.decision, 'block');
  });

  const current = () => visualChange(root, { fetch: false }).fingerprint;

  it('is not answered by screenshots of other code', () => {
    write('.screenshots/manifest.json', JSON.stringify({ fingerprint: '0123456789abcdef' }));
    assert.equal(stop()?.decision, 'block');
  });

  it('is answered by screenshots of the code as it is', () => {
    write('.screenshots/manifest.json', JSON.stringify({ fingerprint: current() }, null, 2));
    assert.equal(stop(), null);
  });

  it('stays answered by a commit, a touch or a checkout that changes no content', () => {
    git('commit', '-q', '--allow-empty', '-m', 'later commit');
    utimesSync(join(root, 'apps/web/src/features/hosts/sections/list.tsx'), new Date(), new Date());
    assert.equal(stop(), null);
  });

  it('stays answered by an edit to a comment', () => {
    write('apps/web/src/features/hosts/sections/list.tsx', '// a note\nx');
    assert.equal(stop(), null);
  });

  it('holds again once a visual file changes', () => {
    write('apps/web/src/features/hosts/sections/list.tsx', 'y');
    assert.equal(stop()?.decision, 'block');
  });

  it('is answered by a not-visual note for the code as it is', () => {
    write('.screenshots/not-visual.md', `renamed a prop\n\nfingerprint: ${current()}\n`);
    assert.equal(stop(), null);
  });

  it('holds an uncommitted deletion of a visual file', () => {
    git('add', '-A', 'apps');
    git('commit', '-q', '-m', 'list');
    write('.screenshots/manifest.json', JSON.stringify({ fingerprint: current() }));
    assert.equal(stop(), null);
    rmSync(join(root, 'apps/web/src/features/hosts/sections/list.tsx'));
    assert.equal(stop()?.decision, 'block');
  });

  it('stays out of a checkout with no camera', () => {
    rmSync(join(root, 'scripts/stack/screens.mjs'));
    assert.equal(stop(), null);
    git('checkout', '-q', '--', 'scripts/stack/screens.mjs');
  });

  it('compares against main when origin/main is older than it', () => {
    git('checkout', '-q', '-f', 'main');
    git('clean', '-fdq');
    write('apps/web/src/on-main.tsx', 'main');
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
