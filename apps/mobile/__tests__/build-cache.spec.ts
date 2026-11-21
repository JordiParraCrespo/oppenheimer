import { mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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

  it('keeps only the most recently used builds', async () => {
    const kept: string[] = [];
    for (const [age, hash] of ['one', 'two', 'three'].entries()) {
      const props = { platform: 'ios', fingerprintHash: hash, runOptions: {} };
      await cache.uploadBuildCache({ ...props, buildPath: builtApp(hash) }, { keep: 2 });
      const entry = (await cache.resolveBuildCache(props)) as string;
      const used = new Date(Date.UTC(2026, 0, 1 + age));
      utimesSync(entry, used, used);
      kept.push(entry);
    }

    expect(readdirSync(dirname(kept[0] as string)).sort()).toEqual([
      'ios-Debug-three.app',
      'ios-Debug-two.app',
    ]);
  });
});
