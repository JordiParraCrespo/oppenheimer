/**
 * The release path's refusals, end to end through the real scripts: a release
 * built without its keys or base URL never leaves release.sh, and
 * `oppctl publish-release` publishes only a manifest whose signature verifies
 * against the installer's keys and whose every artifact matches it.
 *
 * A regression these catch: a publish that copies files before checking them,
 * a check that compares against the wrong file, a tar member that lands
 * outside the release, or a swap that keeps a channel the new installer
 * refuses, would put an unsigned, tampered or uninstallable release where
 * every host installs from.
 *
 * Signing needs OpenSSL 3 (macOS ships LibreSSL; Homebrew's openssl@3 works).
 * The full publish — the rename swap, the api.env rewrite and the unwind —
 * needs the GNU tools the server has (flock, mv -T), so it runs on Linux only.
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
  symlinkSync,
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
 * build: two tiny "artifacts", the manifest and the stamped installer.
 * `build` stands for a rebuild of the same version: same names, other bytes.
 */
function release(
  name,
  { keys = pubA, signWith = keyA, version = '1.2.3', base, channel = 'stable', build = '' } = {},
) {
  const dir = join(tmp, name);
  mkdirSync(dir);
  const targets = ['linux/amd64', 'darwin/arm64'];
  const artifacts = {};
  const sums = [];
  for (const target of targets) {
    const file = `runner_${version}_${target.replace('/', '_')}.tar.gz`;
    writeFileSync(join(dir, file), `binary for ${target} ${version}${build}\n`);
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
    join(dir, `${channel}.json`),
    JSON.stringify({
      schema: 'oppenheimer.release/v1',
      channel,
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
  if (signWith) execFileSync(SIGN, [join(dir, `${channel}.json`), signWith], { env });
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

/** `oppctl publish-release -` with a tar on stdin, the way publish-dev.sh sends one. */
const publishTar = (root, tar, extra = {}) =>
  spawnSync('bash', [OPPCTL, 'publish-release', '-'], {
    encoding: 'utf8',
    env: { ...env, OPP_ROOT: root, ...extra },
    input: tar,
  });

const live = (root) => readlinkSync(join(root, 'public/releases'));

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
  // The installer is in the set, so the one rename published it too.
  assert.equal(readlinkSync(join(root, 'public/install.sh')), 'releases/install.sh');
  assert.equal(sha256(join(root, 'public/install.sh')), sha256(join(first, 'install.sh')));
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
  const ok = publishTar(root, execFileSync('tar', ['-cf', '-', '-C', rolled, '.']));
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(live(root), /-1\.2\.5$/);
  assert.equal(sha256(join(root, 'public/install.sh')), sha256(join(rolled, 'install.sh')));
});

const linux =
  (!openssl3 && 'no OpenSSL 3') || (!gnu && 'needs the GNU tools of the server (Linux)');

test('a tar member outside the release is refused before anything is extracted', {
  skip: linux,
}, () => {
  const root = server('srv-traversal');
  const dir = release('traversal');
  const before = readFileSync(join(root, 'config/api.env'), 'utf8');
  const tar = execFileSync(
    'tar',
    [
      '-cf',
      '-',
      '-C',
      dir,
      '--transform',
      's,^install.sh$,../../config/api.env,',
      'install.sh',
      'stable.json',
      'stable.json.sig',
    ],
    { stdio: ['ignore', 'pipe', 'ignore'] },
  );
  const r = publishTar(root, tar);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /a member named "\.\.\/\.\.\/config\/api\.env"/);
  assert.equal(readFileSync(join(root, 'config/api.env'), 'utf8'), before);
});

test('a tar member that is a link is refused', { skip: linux }, () => {
  const root = server('srv-link');
  const dir = release('link');
  symlinkSync('../../config/api.env', join(dir, 'SHA256SUMS.link'));
  const r = publishTar(root, execFileSync('tar', ['-cf', '-', '-C', dir, '.']));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /SHA256SUMS\.link, which is not a regular file/);
});

test('the installer must still accept the channel a publish carries over', {
  skip: linux,
}, () => {
  // stable is live, signed by A, under an installer that carries A and B.
  const root = server('srv-carry');
  assert.equal(publish(root, release('carry-1', { keys: `${pubA} ${pubB}` })).status, 0);
  const link = live(root);
  // beta, signed by B, ships an installer that carries B alone: hosts trust
  // B, but the shared /install.sh would then refuse the live stable manifest.
  const r = publish(
    root,
    release('carry-2', { keys: pubB, signWith: keyB, channel: 'beta', version: '1.3.0' }),
  );
  assert.notEqual(r.status, 0);
  assert.match(
    r.stderr,
    /the live stable channel is signed by a key the new install\.sh does not carry/,
  );
  assert.equal(live(root), link);
});

test('two channels naming one file must agree on its bytes', { skip: linux }, () => {
  const root = server('srv-collide');
  assert.equal(publish(root, release('collide-1', { channel: 'beta' })).status, 0);
  // stable 1.2.3, rebuilt: the same file names as the live beta, other bytes.
  const r = publish(root, release('collide-2', { build: ' rebuilt' }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /runner_1\.2\.3_\w+\.tar\.gz does not match beta\.json/);
  // The same bytes are fine, and keep both channels.
  assert.equal(publish(root, release('collide-3')).status, 0);
  assert.ok(existsSync(join(root, 'public/releases/beta.json.sig')));
  assert.ok(existsSync(join(root, 'public/releases/stable.json.sig')));
});

test('a publish whose API does not come back puts the previous set and api.env back', {
  skip: linux,
}, () => {
  const root = server('srv-unwind');
  assert.equal(publish(root, release('unwind-1')).status, 0);
  const link = live(root);
  const apiEnv = readFileSync(join(root, 'config/api.env'), 'utf8');

  // Something is deployed, and docker fails every call.
  mkdirSync(join(root, 'releases/r1'), { recursive: true });
  symlinkSync(join(root, 'releases/r1'), join(root, 'current'));
  const bin = join(tmp, 'failing-docker');
  mkdirSync(bin);
  writeFileSync(join(bin, 'docker'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });

  const next = release('unwind-2', { keys: `${pubA} ${pubB}`, version: '1.2.4' });
  const r = run('bash', [OPPCTL, 'publish-release', next], {
    OPP_ROOT: root,
    OPP_HEALTH_TIMEOUT: '1',
    PATH: `${bin}:${env.PATH}`,
  });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /nothing changed/);
  assert.equal(live(root), link);
  assert.equal(
    sha256(join(root, 'public/install.sh')),
    sha256(join(root, 'public/releases/install.sh')),
  );
  assert.equal(readFileSync(join(root, 'config/api.env'), 'utf8'), apiEnv);
});

test('the installer and sign-release.sh --verify agree on what is signed', {
  skip: !openssl3 && 'no OpenSSL 3',
}, () => {
  const dir = release('parity');
  const manifest = join(dir, 'stable.json');
  const verifyManifest = readFileSync(join(ROOT, 'scripts/runner/install.sh'), 'utf8').match(
    /^verify_manifest\(\) \{[\s\S]*?^\}$/m,
  )[0];
  const installer = (keys) =>
    run('sh', ['-c', `${verifyManifest}\nverify_manifest "$SSL" "$1" "$1.sig"`, 'sh', manifest], {
      SSL: openssl3,
      WORK: dir,
      RELEASE_PUBLIC_KEYS: keys,
    }).status;
  const signRelease = (keys) =>
    run(SIGN, ['--verify', manifest, `${manifest}.sig`, keys], { OPENSSL: openssl3 }).status;
  for (const keys of [pubA, pubB, `${pubB} ${pubA}`]) {
    assert.equal(signRelease(keys), installer(keys), `keys: ${keys}`);
  }
  assert.equal(signRelease(pubA), 0);
  assert.notEqual(signRelease(pubB), 0);
});
