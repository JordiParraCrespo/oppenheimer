import { mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Cache = {
  resolveBuildCache: (props: object) => Promise<string | null>;
  uploadBuildCache: (props: object, options?: { keep?: number }) => Promise<void>;
};

const require = createRequire(import.meta.url);
const cache: Cache = require('../build-cache.js');

let home: string;

function builtApp(name: string): string {
  const app = join(home, 'checkout', `${name}.app`);
  mkdirSync(app, { recursive: true });
  writeFileSync(join(app, 'Info.plist'), name);
  return app;
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'build-cache-'));
  vi.stubEnv('HOME', home);
  vi.stubEnv('XDG_CACHE_HOME', join(home, '.cache'));
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(home, { recursive: true, force: true });
});

// A second worktree whose native side matches installs the first one's build
// instead of compiling again; a different fingerprint is a different binary
// and must build. Only an iOS Debug build is handed over: a Release build
// carries its JavaScript inside it, and reusing one would install another
// checkout's code; an Android APK is built for one device's ABI.
describe('the native build cache', () => {
  it('hands a later checkout the iOS Debug build kept for its fingerprint', async () => {
    const debug = {
      platform: 'ios',
      fingerprintHash: 'abc',
      runOptions: { configuration: 'Debug' },
    };
    await cache.uploadBuildCache({ ...debug, buildPath: builtApp('Oppenheimer') });

    const hit = await cache.resolveBuildCache(debug);
    expect(hit).toMatch(/ios-Debug-abc\.app$/);
    expect(readdirSync(hit as string)).toEqual(['Info.plist']);
    expect(await cache.resolveBuildCache({ ...debug, fingerprintHash: 'other' })).toBeNull();
  });

  it('never keeps or hands over a build that embeds its JavaScript, nor an Android one', async () => {
    const release = {
      platform: 'ios',
      fingerprintHash: 'abc',
      runOptions: { configuration: 'Release' },
    };
    const android = {
      platform: 'android',
      fingerprintHash: 'abc',
      runOptions: { variant: 'debug' },
    };
    await cache.uploadBuildCache({ ...release, buildPath: builtApp('Release') });
    await cache.uploadBuildCache({ ...android, buildPath: builtApp('app-debug') });
    await cache.uploadBuildCache({
      platform: 'ios',
      fingerprintHash: 'abc',
      runOptions: {},
      buildPath: builtApp('Debug'),
    });

    expect(await cache.resolveBuildCache(release)).toBeNull();
    expect(await cache.resolveBuildCache(android)).toBeNull();
  });

  it('keeps only the newest builds', async () => {
    const resolve = (hash: string) =>
      cache.resolveBuildCache({ platform: 'ios', fingerprintHash: hash, runOptions: {} });
    const hashes = ['one', 'two', 'three'];
    for (const [age, hash] of hashes.entries()) {
      await cache.uploadBuildCache(
        { platform: 'ios', fingerprintHash: hash, runOptions: {}, buildPath: builtApp(hash) },
        { keep: 2 },
      );
      const kept = join(
        home,
        'Library',
        'Caches',
        'oppenheimer',
        'mobile-builds',
        `ios-Debug-${hash}.app`,
      );
      const linux = join(home, '.cache', 'oppenheimer', 'mobile-builds', `ios-Debug-${hash}.app`);
      const when = new Date(Date.UTC(2026, 0, 1 + age));
      utimesSync(process.platform === 'darwin' ? kept : linux, when, when);
    }
    expect(await resolve('one')).toBeNull();
    expect(await resolve('two')).not.toBeNull();
    expect(await resolve('three')).not.toBeNull();
  });
});
