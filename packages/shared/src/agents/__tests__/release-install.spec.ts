/**
 * The release installs run for real against a fake `curl` that serves a
 * release from disk: a checksum that matches installs, and one that is wrong
 * or missing stops the script before the download is unpacked or run. These
 * are the Linux scripts (`sha256sum`, `ldd`), so they run on Linux only.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { arch, platform, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CODING_AGENTS } from '../catalog.js';
import { HOST_TOOLS } from '../host-tools.js';

// Serves https://<path> from $RELEASES/<path>, `-I -w %{url_effective}` from
// <path>.redirect, and logs every URL asked for; a missing file is curl's 22.
const FAKE_CURL = `#!/bin/sh
out=""; fmt=""; url=""
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift ;;
    -w) fmt="$2"; shift ;;
    https://*) url="$1" ;;
  esac
  shift
done
echo "$url" >>"$RELEASES/requests"
file="$RELEASES/\${url#https://}"
if [ -n "$fmt" ]; then cat "$file.redirect"; exit 0; fi
[ -f "$file" ] || exit 22
if [ -n "$out" ]; then cp "$file" "$out"; else cat "$file"; fi
`;

const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

let root: string;
let home: string;
let releases: string;

function serve(path: string, body: string | Buffer) {
  const file = join(releases, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
}

function run(script: string) {
  const bin = join(root, 'bin');
  return spawnSync('sh', ['-c', script], {
    env: { PATH: `${bin}:/usr/bin:/bin`, HOME: home, RELEASES: releases },
    encoding: 'utf8',
  });
}

const requested = () =>
  existsSync(join(releases, 'requests')) ? readFileSync(join(releases, 'requests'), 'utf8') : '';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'release-install-'));
  home = join(root, 'home');
  releases = join(root, 'releases');
  mkdirSync(home);
  mkdirSync(join(root, 'bin'));
  writeFileSync(join(root, 'bin', 'curl'), FAKE_CURL);
  chmodSync(join(root, 'bin', 'curl'), 0o755);
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe.runIf(platform() === 'linux')('Claude Code from its latest release', () => {
  const base = 'downloads.claude.ai/claude-code-releases';
  const script = CODING_AGENTS['claude-code'].install?.linux ?? '';
  // Stands in for the real binary: `claude install <version>` records itself.
  const binary = '#!/bin/sh\necho "$@" >"$HOME/claude-ran"\n';

  function release(checksum: string, platforms = ['linux-x64', 'linux-arm64']) {
    serve(`${base}/latest`, '9.9.9');
    const entries = [
      // Another platform's checksum first: the script reads its own object.
      `"darwin-arm64": { "binary": "claude", "checksum": "${'0'.repeat(64)}", "size": 1 }`,
      ...platforms.map(
        (p) => `"${p}": { "binary": "claude", "checksum": "${checksum}", "size": 1 }`,
      ),
    ];
    serve(
      `${base}/9.9.9/manifest.json`,
      `{\n  "version": "9.9.9",\n  "platforms": {\n    ${entries.join(',\n    ')}\n  }\n}\n`,
    );
    for (const p of ['linux-x64', 'linux-arm64']) serve(`${base}/9.9.9/${p}/claude`, binary);
  }

  it('runs the verified binary’s own install for the latest version', () => {
    release(sha256(binary));
    const result = run(script);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(readFileSync(join(home, 'claude-ran'), 'utf8')).toBe('install 9.9.9\n');
  });

  it('never runs a binary whose checksum does not match', () => {
    release(sha256('something else'));
    const result = run(script);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('checksum mismatch');
    expect(existsSync(join(home, 'claude-ran'))).toBe(false);
  });

  it('downloads nothing when the manifest has no checksum for this platform', () => {
    release(sha256(binary), []);
    const result = run(script);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('has no checksum');
    expect(requested()).not.toMatch(/\/claude$/m);
    expect(existsSync(join(home, 'claude-ran'))).toBe(false);
  });

  it('refuses a latest pointer that is not a version', () => {
    release(sha256(binary));
    serve(`${base}/latest`, '<html>not found</html>');
    const result = run(script);
    expect(result.status).not.toBe(0);
    expect(requested()).not.toContain('manifest.json');
  });
});

describe.runIf(platform() === 'linux')('gh from its latest release', () => {
  const script = HOST_TOOLS.gh.install?.linux ?? '';
  const ghArch = arch() === 'arm64' ? 'arm64' : 'amd64';
  const name = `gh_2.0.0_linux_${ghArch}`;
  const download = 'github.com/cli/cli/releases/download/v2.0.0';

  function release(checksum: (tarball: Buffer) => string) {
    serve(
      'github.com/cli/cli/releases/latest.redirect',
      'https://github.com/cli/cli/releases/tag/v2.0.0',
    );
    const stage = join(root, 'stage');
    mkdirSync(join(stage, name, 'bin'), { recursive: true });
    writeFileSync(join(stage, name, 'bin', 'gh'), '#!/bin/sh\necho gh\n');
    const tarball = join(root, `${name}.tar.gz`);
    expect(spawnSync('tar', ['-czf', tarball, '-C', stage, name]).status).toBe(0);
    const bytes = readFileSync(tarball);
    serve(`${download}/${name}.tar.gz`, bytes);
    serve(
      `${download}/gh_2.0.0_checksums.txt`,
      `${'1'.repeat(64)}  gh_2.0.0_macOS_arm64.zip\n${checksum(bytes)}  ${name}.tar.gz\n`,
    );
  }

  it('installs the archive the checksum file vouches for', () => {
    release(sha256);
    const result = run(script);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(existsSync(join(home, '.local', 'bin', 'gh'))).toBe(true);
  });

  it('unpacks nothing when the checksum does not match', () => {
    release(() => sha256('tampered'));
    const result = run(script);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('checksum mismatch');
    expect(existsSync(join(home, '.local', 'bin', 'gh'))).toBe(false);
  });
});
