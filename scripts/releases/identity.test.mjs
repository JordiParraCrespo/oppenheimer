import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { releaseIdentity } from './identity.mjs';

test('a release cannot label a different component or package version', () => {
  assert.throws(() =>
    releaseIdentity('api-v1.2.3', { name: '@oppenheimer/api', version: '1.2.4' }),
  );
  assert.throws(() =>
    releaseIdentity('api-v1.2.3', { name: '@oppenheimer/other', version: '1.2.3' }),
  );
});

// oppenheimer:begin runner
test('beta tags select beta while final tags select stable', () => {
  assert.equal(
    releaseIdentity('runner-v0.8.1-beta.2', {
      name: '@oppenheimer/runner',
      version: '0.8.1-beta.2',
    }).channel,
    'beta',
  );
  assert.equal(
    releaseIdentity('api-v1.3.0', { name: '@oppenheimer/api', version: '1.3.0' }).channel,
    'stable',
  );
});

// oppenheimer:end runner

test('malformed tags cannot become image tags or output lines', () => {
  for (const tag of [
    'api-v01.2.3',
    'api-v1.2',
    'api-v1.2.3\nsha=other',
    'api-v1.2.3\n',
    'api-v1.2.3/other',
    'api-v1.2.3-beta.01',
  ]) {
    assert.throws(() => releaseIdentity(tag, { name: '@oppenheimer/api', version: '1.2.3' }));
  }
});

test('CLI binds the release to its tagged commit on main before exporting deployment identity', () => {
  const root = mkdtempSync(join(tmpdir(), 'release-identity-'));
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const output = join(root, 'output');
  const cli = () =>
    spawnSync(process.execPath, [fileURLToPath(new URL('./identity.mjs', import.meta.url))], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        RELEASE_TAG: 'api-v1.2.3',
        GITHUB_REPOSITORY: 'Example/Project',
        GITHUB_OUTPUT: output,
      },
    });
  try {
    git('init', '-b', 'main');
    git('config', 'user.name', 'Release test');
    git('config', 'user.email', 'release@example.invalid');
    mkdirSync(join(root, 'apps/api'), { recursive: true });
    writeFileSync(
      join(root, 'apps/api/package.json'),
      JSON.stringify({ name: '@oppenheimer/api', version: '1.2.3' }),
    );
    git('add', '.');
    git('commit', '-m', 'initial');
    const main = git('rev-parse', 'HEAD');
    git('update-ref', 'refs/remotes/origin/main', main);
    git('tag', 'api-v1.2.3');
    assert.equal(cli().status, 0);
    assert.match(readFileSync(output, 'utf8'), new RegExp(`sha=${main}\\n`));
    assert.match(
      readFileSync(output, 'utf8'),
      /image=ghcr.io\/example\/project\/oppenheimer-api\n/,
    );

    git('commit', '--allow-empty', '-m', 'later');
    assert.notEqual(cli().status, 0, 'a checkout ahead of the release tag must fail');
    git('tag', '-f', 'api-v1.2.3');
    assert.notEqual(cli().status, 0, 'a tagged commit outside main history must fail');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
