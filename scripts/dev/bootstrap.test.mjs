// The bootstrap's report, against a PATH of stand-ins: it must name what is
// missing and fail --check, and never change anything under --check.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'bootstrap.sh');

function stub(dir, name, output) {
  const path = join(dir, name);
  writeFileSync(path, `#!/bin/sh\necho '${output}'\n`);
  chmodSync(path, 0o755);
}

function run(args, stubs, browsers = []) {
  const bin = mkdtempSync(join(tmpdir(), 'bootstrap-'));
  try {
    for (const [name, output] of Object.entries(stubs)) stub(bin, name, output);
    const cache = join(bin, 'ms-playwright');
    for (const dir of browsers) mkdirSync(join(cache, dir), { recursive: true });
    return spawnSync('bash', [SCRIPT, ...args], {
      encoding: 'utf8',
      env: { PATH: `${bin}:/usr/bin:/bin`, HOME: bin, PLAYWRIGHT_BROWSERS_PATH: cache },
    });
  } finally {
    rmSync(bin, { recursive: true, force: true });
  }
}

test('parses', () => {
  const result = spawnSync('bash', ['-n', SCRIPT], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('--check names a Node older than 22 and the tools that are missing, and fails', () => {
  const result = run(['--check'], {
    node: 'v20.11.1',
    pnpm: '9.15.4',
    go: 'go version go1.24.7 linux/amd64',
    'golangci-lint': 'golangci-lint has version 2.5.0',
    gh: 'gh version 2.80.0 (2025-10-01)',
    mise: 'mise must not run under --check',
  });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /todo {2}missing or too old: node\b/);
  assert.match(result.stdout, /ok {4}go 1\.24\.7/);
  assert.doesNotMatch(result.stdout, /done/);
});

const READY = {
  node: 'v22.22.2',
  pnpm: '9.15.4',
  go: 'go version go1.24.7 linux/amd64',
  'golangci-lint': 'golangci-lint has version 2.5.0',
};

test('--check holds Node to the patch package.json engines names', () => {
  const old = run(['--check'], { ...READY, node: 'v22.20.0' });
  assert.match(old.stdout, /missing or too old: node\b/);
  const current = run(['--check'], READY);
  assert.match(current.stdout, /ok {4}node 22\.22\.2/);
});

test('--check passes browsers that are installed and names them when not', () => {
  const absent = run(['--check'], READY);
  assert.match(absent.stdout, /todo {2}pnpm --filter @oppenheimer\/e2e exec playwright install/);
  const present = run(['--check'], READY, ['chromium-1200', 'ffmpeg-1011']);
  assert.match(present.stdout, /ok {4}Playwright chromium and ffmpeg/);
  assert.doesNotMatch(present.stdout, /playwright install chromium/);
});

test('an unknown option is a usage error', () => {
  const result = run(['--nope'], {});
  assert.equal(result.status, 2);
});
