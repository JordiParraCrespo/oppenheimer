// The build cache `expo run:ios` consults before it compiles
// (`buildCacheProvider` in app.config.ts). A native build is keyed by the
// project's fingerprint (@expo/fingerprint: native dependencies, config
// plugins, app config, the icon font's SVGs), which is the same in every checkout whose native side
// is the same. Each session is a git worktree at a path of its own, so Xcode's
// DerivedData starts empty in each, and before this cache every new checkout
// paid for a full native build that another one had already made. Now the
// first build of a fingerprint is kept in one folder on the machine, and every
// checkout with that fingerprint installs it and only starts Metro.
//
// Kept: the newest `keep` builds (default 6), the least recently used out
// first. A build is copied in under a temporary name and renamed, so two
// checkouts finishing the same fingerprint at once leave one whole copy.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_KEEP = 6;

function cacheRoot() {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Caches', 'oppenheimer', 'mobile-builds');
  }
  return path.join(
    process.env.XDG_CACHE_HOME || path.join(home, '.cache'),
    'oppenheimer',
    'mobile-builds',
  );
}

// What may be handed to another checkout, by platform and then configuration
// (iOS `--configuration`, Debug by default). Only a build that loads its
// JavaScript from Metro qualifies: a Release build carries its bundle inside
// the app, which the fingerprint does not cover, so reusing it would install
// another checkout's JavaScript. Expo only asks for iOS simulator builds. No
// Android variant is listed: a debug APK is built for the connected device's
// ABI alone, which the key cannot see.
const CACHEABLE = {
  ios: { default: 'Debug', configurations: ['Debug'] },
};

// The entry's name, or null when the build must not be cached.
function entryName({ platform, fingerprintHash, runOptions }) {
  const policy = CACHEABLE[platform];
  const configuration = runOptions?.configuration ?? policy?.default;
  if (!policy?.configurations.includes(configuration)) {
    return null;
  }
  return `${platform}-${configuration}-${fingerprintHash}`;
}

function findEntry(dir, name) {
  if (!fs.existsSync(dir)) {
    return null;
  }
  const found = fs.readdirSync(dir).find((file) => path.parse(file).name === name);
  return found ? path.join(dir, found) : null;
}

function prune(dir, platform, keep) {
  const entries = fs
    .readdirSync(dir)
    .filter((file) => file.startsWith(`${platform}-`) && !file.startsWith('.'))
    .map((file) => ({ file, used: fs.statSync(path.join(dir, file)).mtimeMs }))
    .sort((a, b) => b.used - a.used);
  for (const { file } of entries.slice(keep)) {
    fs.rmSync(path.join(dir, file), { recursive: true, force: true });
  }
}

async function resolveBuildCache({ platform, fingerprintHash, runOptions }) {
  const name = entryName({ platform, fingerprintHash, runOptions });
  if (!name) {
    return null;
  }
  const entry = findEntry(cacheRoot(), name);
  if (!entry) {
    console.log(
      `Build cache: no ${platform} build for fingerprint ${fingerprintHash}; building it.`,
    );
    return null;
  }
  // Marks it as recently used, so pruning drops the builds no checkout asks for.
  const now = new Date();
  fs.utimesSync(entry, now, now);
  console.log(`Build cache: reusing ${entry}`);
  return entry;
}

async function uploadBuildCache({ platform, fingerprintHash, buildPath, runOptions }, options) {
  const name = entryName({ platform, fingerprintHash, runOptions });
  if (!name) {
    return;
  }
  const dir = cacheRoot();
  if (findEntry(dir, name)) {
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, name + path.extname(buildPath));
  const partial = path.join(dir, `.${name}.${process.pid}.partial`);
  try {
    await fs.promises.cp(buildPath, partial, { recursive: true, verbatimSymlinks: true });
    fs.renameSync(partial, target);
    console.log(`Build cache: kept ${target}`);
  } catch (error) {
    // Another checkout kept the same build first, or the disk is full: the
    // app this run built is installed either way.
    fs.rmSync(partial, { recursive: true, force: true });
    if (!fs.existsSync(target)) {
      console.warn(`Build cache: could not keep the build: ${error.message}`);
    }
    return;
  }
  prune(dir, platform, options?.keep ?? DEFAULT_KEEP);
}

module.exports = { resolveBuildCache, uploadBuildCache };
