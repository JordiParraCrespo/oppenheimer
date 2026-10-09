/**
 * The release path's refusals, end to end through the real scripts: a release
 * built without its keys or base URL never leaves release.sh, and
 * `oppctl publish-release` publishes only a manifest whose signature verifies
 * against the installer's keys and whose every artifact matches it.
 *
 * A regression these catch: a publish that copies files before checking them,
 * or a check that compares against the wrong file, would put an unsigned or
 * tampered release where every host installs from.
 *
 * Signing needs OpenSSL 3 (macOS ships LibreSSL; Homebrew's openssl@3 works).
 * The full publish — the rename swap and the api.env rewrite — needs the GNU
 * tools the server has (flock, mv -T), so it runs on Linux only.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OPPCTL = join(ROOT, 'deploy/dev/bin/oppctl');
const SIGN = join(ROOT, 'scripts/runner/sign-release.sh');
const RELEASE = join(ROOT, 'scripts/runner/release.sh');
const HOST = 'dev.example.test';

const openssl3 = [
  'openssl',
  '/opt/homebrew/opt/openssl@3/bin/openssl',
  '/usr/local/opt/openssl@3/bin/openssl',
].find((bin) => {
  const r = spawnSync(bin, ['version'], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.startsWith('OpenSSL 3');
});
const gnu = process.platform === 'linux' && spawnSync('flock', ['--version']).status === 0;
const env = {
  ...process.env,
  // sign-release.sh calls `openssl` by name.
  PATH: openssl3?.includes('/') ? `${dirname(openssl3)}:${process.env.PATH}` : process.env.PATH,
};

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const run = (cmd, args, extra = {}) =>
  spawnSync(cmd, args, { encoding: 'utf8', env: { ...env, ...extra } });

let tmp;
let keyA;
let keyB;
let pubA;
let pubB;

before(() => {
  tmp = mkdtempSync(join(tmpdir(), 'runner-publish-'));
  if (!openssl3) return;
  keyA = join(tmp, 'a.key');
  keyB = join(tmp, 'b.key');
  for (const key of [keyA, keyB]) execFileSync(SIGN, ['--keygen', key], { env });
  pubA = execFileSync(SIGN, ['--pubkey', keyA], { env, encoding: 'utf8' }).trim();
  pubB = execFileSync(SIGN, ['--pubkey', keyB], { env, encoding: 'utf8' }).trim();
});
after(() => rmSync(tmp, { recursive: true, force: true }));

/**
 * A release directory shaped like the one release.sh writes, without the Go
 * build: two tiny "artifacts", the manifest, the stamped installer, install.env.
 */
function release(name, { keys = pubA, signWith = keyA, version = '1.2.3', base } = {}) {
  const dir = join(tmp, name);
  mkdirSync(dir);
  const targets = ['linux/amd64', 'darwin/arm64'];
  const artifacts = {};
  const sums = [];
  for (const target of targets) {
    const file = `runner_${version}_${target.replace('/', '_')}.tar.gz`;
    writeFileSync(join(dir, file), `binary for ${target} ${version}\n`);
    const digest = sha256(join(dir, file));
    sums.push(`${digest}  ./${file}`);
    artifacts[target] = {
      url: `${base ?? `https://${HOST}/releases`}/${file}`,
      sha256: digest,
      size: readFileSync(join(dir, file)).length,
    };
  }
  writeFileSync(join(dir, 'SHA256SUMS'), `${sums.join('\n')}\n`);
  writeFileSync(
    join(dir, 'stable.json'),
    JSON.stringify({
      schema: 'oppenheimer.release/v1',
      channel: 'stable',
      version,
      releasedAt: '2026-10-09T00:00:00Z',
      minSupported: '',
      artifacts,
    }),
  );
  const installer = readFileSync(join(ROOT, 'scripts/runner/install.sh'), 'utf8').replace(
    /^RELEASE_PUBLIC_KEYS=""$/m,
    `RELEASE_PUBLIC_KEYS="${keys}"`,
  );
  writeFileSync(join(dir, 'install.sh'), installer);
  writeFileSync(
    join(dir, 'install.env'),
    `RUNNER_INSTALL_SHA256=${sha256(join(dir, 'install.sh'))}\n`,
  );
  if (signWith) execFileSync(SIGN, [join(dir, 'stable.json'), signWith], { env });
  return dir;
}

/** A server root as `oppctl setup` leaves it, with nothing deployed. */
function server(name) {
  const root = join(tmp, name);
  mkdirSync(join(root, 'config'), { recursive: true });
  mkdirSync(join(root, 'public/releases'), { recursive: true });
  writeFileSync(join(root, 'config/host.env'), `DEV_HOSTNAME=${HOST}\n`);
  writeFileSync(
    join(root, 'config/api.env'),
    'RUNNER_RELEASE_BASE_URL=\nRUNNER_RELEASE_CHANNEL=stable\nRUNNER_INSTALL_URL=\nRUNNER_INSTALL_SHA256=\n',
  );
  chmodSync(join(root, 'config/api.env'), 0o600);
  return root;
}

const publish = (root, ...args) =>
  run('bash', [OPPCTL, 'publish-release', ...args], { OPP_ROOT: root });

test('release.sh refuses to build without release keys', () => {
  const r = run('bash', [RELEASE, '9.9.9'], {
    RELEASE_PUBLIC_KEYS: '',
    RELEASE_BASE_URL: `https://${HOST}/releases`,
  });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /RELEASE_PUBLIC_KEYS is empty/);
});

test('release.sh refuses to build without an https base URL', () => {
  const key = `${'A'.repeat(43)}=`;
  for (const base of ['', `http://${HOST}/releases`]) {
    const r = run('bash', [RELEASE, '9.9.9'], { RELEASE_PUBLIC_KEYS: key, RELEASE_BASE_URL: base });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /RELEASE_BASE_URL/);
  }
});

test('a signed release whose artifacts match passes the check and changes nothing', {
  skip: !openssl3 && 'no OpenSSL 3',
}, () => {
  const root = server('srv-ok');
  const r = publish(root, '--check', release('ok'));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /stable\.json 1\.2\.3 is signed and every artifact matches it/);
  assert.equal(existsSync(join(root, 'public/install.sh')), false);
});

test('an unsigned manifest is refused', { skip: !openssl3 && 'no OpenSSL 3' }, () => {
  const r = publish(server('srv-unsigned'), release('unsigned', { signWith: null }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no stable\.json\.sig; an unsigned manifest is never published/);
});

test('a manifest signed by a key the installer does not carry is refused', {
  skip: !openssl3 && 'no OpenSSL 3',
}, () => {
  const r = publish(server('srv-wrongkey'), release('wrongkey', { signWith: keyB }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /does not verify against the keys in install\.sh/);
});

test('a manifest edited after signing is refused', { skip: !openssl3 && 'no OpenSSL 3' }, () => {
  const dir = release('edited');
  const manifest = join(dir, 'stable.json');
  writeFileSync(manifest, readFileSync(manifest, 'utf8').replace('1.2.3', '1.2.4'));
  const r = publish(server('srv-edited'), dir);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /does not verify/);
});

test('an artifact whose digest is not the signed one is refused', {
  skip: !openssl3 && 'no OpenSSL 3',
}, () => {
  const dir = release('tampered');
  writeFileSync(join(dir, 'runner_1.2.3_linux_amd64.tar.gz'), 'something else\n');
  const r = publish(server('srv-tampered'), dir);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /runner_1\.2\.3_linux_amd64\.tar\.gz does not match stable\.json: sha256/);
});

test('a manifest built for another release host is refused', {
  skip: !openssl3 && 'no OpenSSL 3',
}, () => {
  const r = publish(
    server('srv-host'),
    release('otherhost', { base: 'https://elsewhere.test/releases' }),
  );
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /not at https:\/\/dev\.example\.test\/releases\//);
});

test('an installer without release keys is refused', { skip: !openssl3 && 'no OpenSSL 3' }, () => {
  const r = publish(server('srv-nokeys'), release('nokeys', { keys: '' }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /install\.sh carries no release keys/);
});

test('a file no manifest names is refused', { skip: !openssl3 && 'no OpenSSL 3' }, () => {
  const dir = release('extra');
  writeFileSync(join(dir, 'notes.txt'), 'hi\n');
  const r = publish(server('srv-extra'), dir);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /has notes\.txt, which no manifest names/);
});

test('a publish swaps the set in, sets the installer digest, and then refuses a key the runners do not trust', {
  skip: (!openssl3 && 'no OpenSSL 3') || (!gnu && 'needs the GNU tools of the server (Linux)'),
}, () => {
  const root = server('srv-live');
  const first = release('live-1');
  const r = publish(root, first);
  assert.equal(r.status, 0, r.stderr);

  const link = readlinkSync(join(root, 'public/releases'));
  assert.match(link, /^\.releases\/\d{8}T\d{6}Z-1\.2\.3$/);
  assert.equal(
    sha256(join(root, 'public/releases/stable.json')),
    sha256(join(first, 'stable.json')),
  );
  assert.ok(existsSync(join(root, 'public/releases/stable.json.sig')));
  const apiEnv = readFileSync(join(root, 'config/api.env'), 'utf8');
  assert.match(
    apiEnv,
    new RegExp(`^RUNNER_INSTALL_SHA256=${sha256(join(first, 'install.sh'))}$`, 'm'),
  );
  assert.match(apiEnv, new RegExp(`^RUNNER_RELEASE_BASE_URL=https://${HOST}/releases$`, 'm'));
  assert.match(apiEnv, new RegExp(`^RUNNER_INSTALL_URL=https://${HOST}/install\\.sh$`, 'm'));

  // Signed and self-consistent, but by a key no installed runner trusts.
  const rogue = release('live-2', { keys: pubB, signWith: keyB, version: '1.2.4' });
  const refused = publish(root, rogue);
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /not signed by a key the published runners trust/);
  assert.equal(readlinkSync(join(root, 'public/releases')), link);

  // Rolling in a second key: signed with the trusted one, carrying both,
  // and streamed as a tar the way publish-dev.sh sends it.
  const rolled = release('live-3', { keys: `${pubA} ${pubB}`, version: '1.2.5' });
  const ok = spawnSync('bash', [OPPCTL, 'publish-release', '-'], {
    encoding: 'utf8',
    env: { ...env, OPP_ROOT: root },
    input: execFileSync('tar', ['-cf', '-', '-C', rolled, '.']),
  });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(readlinkSync(join(root, 'public/releases')), /-1\.2\.5$/);
});
