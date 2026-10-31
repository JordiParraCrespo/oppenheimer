// The shell hooks, run as Claude Code runs them, on throwaway repositories:
// the architecture check cruises only the packages that changed and blocks on
// a violation, the formatter warns once when Biome is missing, and the
// session-start install is a no-op when node_modules matches the lockfile.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const HOOKS = dirname(fileURLToPath(import.meta.url));

function repo(prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
      cwd: root,
      encoding: 'utf8',
    });
  const write = (path, body = 'x', mode) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
    if (mode) chmodSync(join(root, path), mode);
  };
  git('init', '-q', '-b', 'main');
  return { root, git, write };
}

function run(root, hook, input = {}, env = {}) {
  const result = spawnSync(join(HOOKS, hook), {
    cwd: root,
    env: { ...process.env, ...env },
    input: JSON.stringify(input),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}

describe('arch-check.sh', () => {
  const { root, git, write } = repo('arch-check-');
  after(() => rmSync(root, { recursive: true, force: true }));
  // A depcruise that records where it ran and fails where a `VIOLATION` file sits.
  write(
    'node_modules/.bin/depcruise',
    '#!/bin/sh\npwd >> "$CRUISED"\nif [ -f src/VIOLATION ]; then echo "error no-way: src/VIOLATION"; exit 1; fi\n',
    0o755,
  );
  const packages = ['apps/api'];
  // oppenheimer:begin web
  packages.push('packages/frontend/core');
  // oppenheimer:end web
  for (const pkg of packages) {
    write(`${pkg}/package.json`, '{}');
    write(`${pkg}/.dependency-cruiser.cjs`, '');
    write(`${pkg}/src/index.ts`);
  }
  write('.gitignore', 'node_modules\n');
  git('add', '.gitignore', ...packages);
  git('commit', '-q', '-m', 'init');
  const cruised = join(root, 'cruised.log');
  const stop = (input = {}) => {
    rmSync(cruised, { force: true });
    const verdict = run(root, 'arch-check.sh', input, { CRUISED: cruised });
    const where = existsSync(cruised) ? readFileSync(cruised, 'utf8').trim().split('\n') : [];
    return { verdict, where: where.map((dir) => dir.slice(root.length + 1)) };
  };

  it('does nothing on a clean tree', () => {
    assert.deepEqual(stop(), { verdict: null, where: [] });
  });

  it('cruises only the package that changed', () => {
    write('apps/api/src/index.ts', 'y');
    assert.deepEqual(stop(), { verdict: null, where: ['apps/api'] });
  });

  it('does not cruise a package again until its changes do', () => {
    assert.deepEqual(stop().where, []);
  });

  // oppenheimer:begin web
  it('leaves the API alone when only a frontend package changed', () => {
    write('packages/frontend/core/src/index.ts', 'y');
    assert.deepEqual(stop().where, ['packages/frontend/core']);
  });
  // oppenheimer:end web

  it('blocks the stop on a violation, naming the package', () => {
    write('apps/api/src/VIOLATION');
    const { verdict, where } = stop();
    assert.deepEqual(where, ['apps/api']);
    assert.equal(verdict?.decision, 'block');
    assert.match(verdict.reason, /apps\/api\n\s*error no-way/);
  });

  it('cruises a failed package again on the next stop', () => {
    assert.equal(stop().verdict?.decision, 'block');
  });

  it('lets the second stop of a turn through', () => {
    assert.deepEqual(stop({ stop_hook_active: true }), { verdict: null, where: [] });
  });
});

describe('format-on-edit.sh', () => {
  const { root, write } = repo('format-on-edit-');
  after(() => rmSync(root, { recursive: true, force: true }));
  write('a.ts', 'const   a=1');
  const edit = (session) =>
    run(root, 'format-on-edit.sh', { session_id: session, tool_input: { file_path: join(root, 'a.ts') } }, {
      CLAUDE_PROJECT_DIR: root,
    });

  it('says once per session that Biome is missing, instead of nothing', () => {
    const session = `t${process.pid}${Date.now()}`;
    assert.match(edit(session)?.systemMessage ?? '', /Biome is not installed/);
    assert.equal(edit(session), null);
  });

  it('formats the file with the checkout’s own Biome', () => {
    write('node_modules/.bin/biome', '#!/bin/sh\nfor f; do :; done\necho formatted > "$f"\n', 0o755);
    assert.equal(edit('any'), null);
    assert.equal(readFileSync(join(root, 'a.ts'), 'utf8').trim(), 'formatted');
  });
});

describe('session-start.sh', () => {
  const { root, write } = repo('session-start-');
  after(() => rmSync(root, { recursive: true, force: true }));
  write('pnpm-lock.yaml', 'lockfileVersion: 9.0\n');
  // A pnpm that records each install and makes node_modules.
  write('bin/pnpm', '#!/bin/sh\necho "$@" >> "$INSTALLS"\nmkdir -p node_modules\n', 0o755);
  const installs = join(root, 'installs.log');
  const start = (env = {}) => {
    const result = spawnSync(join(HOOKS, 'session-start.sh'), {
      cwd: root,
      env: {
        ...process.env,
        PATH: `${join(root, 'bin')}:${process.env.PATH}`,
        CLAUDE_PROJECT_DIR: root,
        INSTALLS: installs,
        ...env,
      },
      input: '{"source":"startup"}',
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const count = () => (existsSync(installs) ? readFileSync(installs, 'utf8').trim().split('\n').length : 0);

  it('only says node_modules is missing on a machine of its own', () => {
    assert.match(start({ CLAUDE_CODE_REMOTE: '' }), /node_modules is missing/);
    assert.equal(count(), 0);
  });

  it('installs from the lockfile in a cloud session', () => {
    assert.match(start({ CLAUDE_CODE_REMOTE: 'true' }), /Installed dependencies/);
    assert.equal(readFileSync(installs, 'utf8').trim(), 'install --frozen-lockfile');
  });

  it('does nothing while node_modules matches the lockfile', () => {
    assert.equal(start({ CLAUDE_CODE_REMOTE: 'true' }), '');
    assert.equal(count(), 1);
  });

  it('installs again once the lockfile changes', () => {
    write('pnpm-lock.yaml', 'lockfileVersion: 9.0\nchanged: true\n');
    start({ CLAUDE_CODE_REMOTE: 'true' });
    assert.equal(count(), 2);
  });

  it('never fails the session when the install does', () => {
    write('bin/pnpm', '#!/bin/sh\nexit 1\n', 0o755);
    write('pnpm-lock.yaml', 'lockfileVersion: 9.0\nchanged: again\n');
    assert.match(start({ CLAUDE_CODE_REMOTE: 'true' }), /failed/);
  });
});
